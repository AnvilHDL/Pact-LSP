/**
 * Pact Compiler Wrapper for TypeScript
 *
 * This module provides a TypeScript interface to the Pact compiler (bin/pact).
 * It executes the binary with the -json flag and parses JSON output to extract
 * compilation errors with precise location information.
 *
 * Optional compiler features are detected from the binary's `-help` output:
 * `-just-check` skips code generation, and `-ast` (when available) adds the
 * annotated AST that powers hover, go-to-definition, references and hints.
 *
 * JSON Format Parsed:
 * ```json
 * {
 *   "success": boolean,
 *   "errors": [
 *     {
 *       "type": "warning" | "error",
 *       "path": string | null,
 *       "trace": {
 *         "start": {
 *           "line": number,
 *           "col": number
 *         },
 *         "end": {
 *           "line": number,
 *           "col": number
 *         }
 *       } | null,
 *       "desc": string
 *     }
 *   ],
 *   "output": string | null
 *   "ast": unknown[] | null
 * }
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { AnvilAst } from './ast/AnvilAst';
import { AnvilCompUnit, AnvilSpan, AnvilPosition } from './ast/schema';
import { compilerLogger } from '../utils/logger';

/**
 * JSON trace structure from anvil compiler
 */

interface AnvilJsonTrace {
  start: AnvilPosition;
  end: AnvilPosition;
}

type AnvilJsonFragment =
  | { kind: 'text'; text: string }
  | {
      kind: 'codespan';
      text?: string;
      path?: string | null;
      trace: AnvilJsonTrace;
    };

interface AnvilJsonError {
  type: 'warning' | 'error';
  path?: string | null;
  description: AnvilJsonFragment[];
}

/**
 * JSON error structure from anvil compiler
 */
interface AnvilJsonError {
  type: 'warning' | 'error';
  path?: string | null;
  trace?: AnvilJsonTrace | null;
  desc: string;
}

/**
 * JSON output structure from anvil compiler
 */
interface AnvilJsonOutput {
  success: boolean;
  errors: AnvilJsonError[];
  output?: string | null;
  ast?: AnvilCompUnit[] | null;
}

/**
 * Represents information about a compilation error from the Anvil compiler
 */
export interface AnvilCompilationErrorInfo {
  /** The file path where the error occurred relative to the project root */
  filepath: string;
  /** The span of the error in the source file */
  span: AnvilSpan;
  /** The full error message description */
  message: string;
}

/**
 * Represents a compilation error from the Anvil compiler
 */
export interface AnvilCompilationError extends AnvilCompilationErrorInfo {
  /** The error type: "warning" or "error" */
  type: 'warning' | 'error';

  /** Other supplementary information about the error */
  supplementaryInfo?: AnvilCompilationErrorInfo[];
}

/**
 * Result of compiling an Anvil file
 */
export interface AnvilCompilationResult {
  /** Whether the compilation was successful (no errors) */
  success: boolean;
  /** Array of parsed compilation errors */
  errors: AnvilCompilationError[];
  /** Raw stderr output from the compiler */
  stderr: string;
  /** Raw stdout output from the compiler */
  stdout: string;
  /** Anvil AST representation */
  ast?: AnvilAst | null;
  /**
   * Whether the compiler was asked for an AST, i.e. whether it supports `-ast`.
   * Undefined if the compiler was never invoked.
   */
  astSupported?: boolean;
}

/**
 * Command-line features detected from a compiler binary's `-help` output.
 */
export interface AnvilCompilerCapabilities {
  /** Supports `-ast` (annotated AST JSON output, required for semantic features). */
  astOutput: boolean;
  /** Supports `-just-check` (type checking only, skipping code generation). */
  justCheck: boolean;
}

export interface AnvilCompilerOptions {
  /** Extra arguments passed to the compiler ahead of the language server's own flags. */
  extraArgs?: string[];
  /** Kill the compiler and report an error after this many milliseconds (0 disables). */
  timeoutMs?: number;
}

export const DEFAULT_COMPILE_TIMEOUT_MS = 15000;

/**
 * Pact compiler wrapper that executes the bin/pact binary and parses compilation errors.
 *
 * @example
 * ```typescript
 * const compiler = new AnvilCompiler('/path/to/project');
 * const result = await compiler.compile('src/example.anvil');
 *
 * if (!result.success) {
 *   result.errors.forEach(error => {
 *     console.log(`${error.filepath}:${error.trace.start.line}:${error.trace.start.col} - ${error.message}`);
 *   });
 * }
 * ```
 */
export class AnvilCompiler {
  public readonly projectRoot: string;
  private readonly anvilBinaryPath: string;
  private readonly extraArgs: string[];
  private readonly timeoutMs: number;

  private static readonly capabilitiesCache = new Map<
    string,
    Promise<AnvilCompilerCapabilities>
  >();

  constructor(
    projectRoot?: string,
    anvilBinaryPath?: string,
    options?: AnvilCompilerOptions,
  ) {
    this.projectRoot = projectRoot || process.cwd();
    this.anvilBinaryPath = anvilBinaryPath || 'pact';
    this.extraArgs = options?.extraArgs ?? [];
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS;
  }

  /**
   * Parse the option list printed by the compiler's `-help` flag.
   */
  static parseCapabilities(helpText: string): AnvilCompilerCapabilities {
    const hasFlag = (flag: string) =>
      new RegExp(`(^|\\s)${flag}(\\s|$)`, 'm').test(helpText);
    return {
      astOutput: hasFlag('-ast'),
      justCheck: hasFlag('-just-check'),
    };
  }

  /**
   * Detect which optional flags the compiler binary supports.
   *
   * Results are cached per binary. For binaries given as a path, the cache is
   * keyed on the file's modification time, so rebuilding the compiler (e.g. to
   * add `-ast` support) is picked up without restarting the server.
   */
  async getCapabilities(): Promise<AnvilCompilerCapabilities> {
    let stamp = '';
    if (this.anvilBinaryPath.includes(path.sep)) {
      try {
        const resolved = path.resolve(this.projectRoot, this.anvilBinaryPath);
        stamp = String(fs.statSync(resolved).mtimeMs);
      } catch (_) {
        // Missing binary: let the spawn below report it.
      }
    }
    const key = [this.projectRoot, this.anvilBinaryPath, stamp].join('\0');

    let capabilities = AnvilCompiler.capabilitiesCache.get(key);
    if (!capabilities) {
      capabilities = this.runAnvil(['-help']).then(({ stdout, stderr }) =>
        AnvilCompiler.parseCapabilities(stdout + '\n' + stderr),
      );
      AnvilCompiler.capabilitiesCache.set(key, capabilities);
      // Do not cache failures, e.g. a binary that is not installed yet.
      capabilities.catch(() => AnvilCompiler.capabilitiesCache.delete(key));
    }
    return capabilities;
  }

  /**
   * Compile one or more Anvil files using JSON output
   * @param filePaths Array of file paths to compile
   * @returns Promise<CompilationResult>
   */
  async compile(
    filePaths: string | string[],
    fileData?: Record<string, string>,
  ): Promise<AnvilCompilationResult> {
    const files = Array.isArray(filePaths) ? filePaths : [filePaths];
    fileData = { ...fileData }; // Clone fileData

    if (!files || files.length === 0) {
      return {
        success: true,
        errors: [],
        stderr: '',
        stdout: '',
      };
    }

    if (files.length > 1) {
      return {
        success: false,
        errors: [
          {
            type: 'error',
            filepath: '',
            span: {
              file_name: null,
              start: { line: 1, col: 0 },
              end: { line: 1, col: Number.MAX_VALUE },
            },
            message:
              'AnvilCompiler only supports compiling one file at a time, but language server was asked to compile multiple files.',
          },
        ],
        stderr: '',
        stdout: '',
      };
    }

    const hasInMemoryData = fileData[files[0]] !== undefined;

    if (process.env.DEBUG) {
      compilerLogger.info('Input files:', files);
      compilerLogger.info('');
    }

    try {
      const capabilities = await this.getCapabilities();
      const args = [
        ...this.extraArgs,
        ...(capabilities.astOutput ? ['-ast'] : []),
        '-json',
        ...(capabilities.justCheck ? ['-just-check'] : []),
        ...(hasInMemoryData ? ['-stdin'] : []),
        files[0],
      ];
      const astSupported = capabilities.astOutput;

      const stdinData = hasInMemoryData ? fileData[files[0]] : undefined;
      const { stdout, stderr, exitCode, timedOut } = await this.runAnvil(
        args,
        stdinData,
        this.timeoutMs,
      );

      if (timedOut) {
        return {
          success: false,
          errors: [
            AnvilCompiler.fileLevelError(
              `Pact compiler timed out after ${this.timeoutMs / 1000}s and was stopped.\n\n` +
                `Increase the "pact.compileTimeout" setting, or pass flags such as ` +
                `-disable-compat-checks via "pact.compilerArgs" to speed up checking.`,
            ),
          ],
          stderr,
          stdout,
          astSupported,
        };
      }

      let astOutput: AnvilAst | undefined = undefined;

      try {
        const jsonOutput: AnvilJsonOutput = JSON.parse(stdout);
        const errors = this.convertJsonErrors(jsonOutput.errors);

        if (jsonOutput.ast) {
          try {
            astOutput = AnvilAst.parse(this.projectRoot, jsonOutput.ast);
            compilerLogger.info(
              'Successfully parsed AST output from Pact compiler',
            );
          } catch (astParseError) {
            compilerLogger.error(
              'Error parsing AST output from Pact compiler:',
              astParseError,
            );
            const truncatedPreview = JSON.stringify(jsonOutput.ast).slice(
              0,
              1000,
            );
            errors.push(
              AnvilCompiler.fileLevelError(
                `Error: Incompatible Pact compiler! AST output does not match expected schema:\n\n` +
                  `${astParseError}\n\n` +
                  `AST output preview (truncated):\n${truncatedPreview}`,
              ),
            );
          }
        }

        return {
          success: jsonOutput.success,
          errors,
          stderr,
          stdout,
          ast: astOutput,
          astSupported,
        };
      } catch (parseError) {
        // If JSON parsing fails, treat as compilation error
        compilerLogger.error('Error parsing compiler output:', parseError);
        const cleanStderr = AnvilCompiler.stripAnsi(stderr).trim();
        const message =
          stdout.trim() === ''
            ? `Pact compiler exited with code ${exitCode} without producing JSON output.` +
              (cleanStderr ? `\n\n${cleanStderr}` : '')
            : `Failed to parse compiler output as JSON: ${parseError}\n\nRaw output:\n${stdout}\n\nRaw stderr:\n${cleanStderr}`;
        return {
          success: false,
          errors: [AnvilCompiler.fileLevelError(message)],
          stderr,
          stdout,
          astSupported,
        };
      }
    } catch (error) {
      compilerLogger.error('Error spawning pact process:', error);

      return {
        success: false,
        errors: [
          AnvilCompiler.fileLevelError(
            `Failed to execute Pact compiler: ${error instanceof Error ? error.message : String(error)}\n\n` +
              `Ensure it's in your PATH or set "pact.executablePath" in the Pact Language Server extension settings`,
          ),
        ],
        stderr: error instanceof Error ? error.message : String(error),
        stdout: '',
      };
    }
  }

  /** An error attached to the first line of the file, for failures without a source location. */
  private static fileLevelError(message: string): AnvilCompilationError {
    return {
      type: 'error',
      filepath: '',
      span: {
        file_name: null,
        start: { line: 1, col: 0 },
        end: { line: 1, col: Number.MAX_VALUE },
      },
      message,
    };
  }

  private static stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex -- matching terminal escape codes
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private runAnvil(
    args: string[],
    stdinData?: string,
    timeoutMs?: number,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }> {
    return new Promise((resolve, reject) => {
      compilerLogger.info(
        `Executing Pact: ${this.anvilBinaryPath} ${args.join(' ')}`,
      );
      const proc = spawn(this.anvilBinaryPath, args, {
        cwd: this.projectRoot,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer =
        timeoutMs && timeoutMs > 0
          ? setTimeout(() => {
              timedOut = true;
              proc.kill('SIGKILL');
            }, timeoutMs)
          : null;

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        compilerLogger.info(`Pact process exited with code ${code}`);
        resolve({ stdout, stderr, exitCode: code, timedOut });
      });

      proc.on('error', (error) => {
        if (timer) clearTimeout(timer);
        reject(error);
      });

      // The compiler may exit before reading all of stdin (e.g. on a crash);
      // the resulting EPIPE is reported through the exit code instead.
      proc.stdin.on('error', () => {});

      if (stdinData) {
        proc.stdin.write(stdinData + '\n');
      }

      proc.stdin.end();
    });
  }

  /**
   * Convert JSON errors from anvil compiler to our interface
   * @param jsonErrors Array of JSON errors from compiler
   * @returns Array of AnvilCompilationError objects
   */
  private convertJsonErrors(
    jsonErrors: AnvilJsonError[],
  ): AnvilCompilationError[] {
    return jsonErrors.map((error) => {
      // Find the first codespan fragment
      const codespan = error.description.find((f) => f.kind === 'codespan') as
        | (AnvilJsonFragment & { kind: 'codespan' })
        | undefined;

      let startLine = 1,
        endLine = 1,
        startCol = 0,
        endCol = 0,
        filepath = error.path || '';

      if (codespan && codespan.trace) {
        startLine = codespan.trace.start.line;
        endLine = codespan.trace.end.line;
        startCol = codespan.trace.start.col;
        endCol = codespan.trace.end.col;
        if (codespan.path) {
          filepath = codespan.path;
        }
      }

      // Assemble full error message from all text fragments
      let message = '';
      const numberOfCodespanFragments = error.description.filter(
        (f) => f.kind === 'codespan',
      ).length;
      for (const fragment of error.description) {
        if (fragment.kind === 'text' && fragment.text) {
          message += fragment.text || '';
        } else if (
          fragment.kind === 'codespan' &&
          numberOfCodespanFragments > 1
        ) {
          const relPath = path.relative(
            this.projectRoot,
            fragment.path || filepath,
          );
          message += `${relPath}:${fragment.trace.start.line}:${fragment.trace.start.col}:\n`;
          message += fragment.text || '';
        }
        if (fragment.text && !fragment.text.endsWith('\n')) {
          message += '\n';
        }
      }

      // Assemble supplementary info if multiple codespans
      const supplementaryInfo: AnvilCompilationErrorInfo[] = [];
      if (numberOfCodespanFragments > 1) {
        let codespanDescribedBy = ''; // Text immediately preceding the codespan
        for (const fragment of error.description) {
          switch (fragment.kind) {
            case 'text':
              codespanDescribedBy = fragment.text?.trim().replace(/:$/, '');
              break;
            case 'codespan':
              supplementaryInfo.push({
                filepath: fragment.path || filepath,
                span: {
                  file_name: fragment.path || filepath || null,
                  start: fragment.trace.start,
                  end: fragment.trace.end,
                },
                message: codespanDescribedBy.trim(),
              });

              codespanDescribedBy = '';
          }
        }
      }

      return {
        type: error.type,
        filepath,
        span: {
          file_name: filepath || null,
          start: { line: startLine, col: startCol },
          end: { line: endLine, col: endCol },
        },
        message: message,
        supplementaryInfo:
          supplementaryInfo.length > 0 ? supplementaryInfo : undefined,
      };
    });
  }

  /**
   * Get the path to the anvil binary
   */
  getAnvilBinaryPath(): string {
    return this.anvilBinaryPath;
  }
}

/**
 * Convenience function to compile Anvil files
 * @param filePaths File path(s) to compile
 * @param projectRoot Optional project root directory
 * @returns Promise<CompilationResult>
 */
export async function compileAnvil(
  filePaths: string | string[],
  projectRoot?: string,
): Promise<AnvilCompilationResult> {
  const compiler = new AnvilCompiler(projectRoot);
  return compiler.compile(filePaths);
}
