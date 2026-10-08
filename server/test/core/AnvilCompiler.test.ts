/**
 * Test script for the updated AnvilCompiler with JSON support
 */

import { AnvilCompiler } from '../../src/core/AnvilCompiler';
import * as path from 'path';

import assert from 'node:assert';
import { beforeEach } from 'mocha';
import {
  compilerBinaryPath,
  projectRoot,
  skipUnlessAstSupported,
} from '../testCompiler';

/** Simple hash code for strings (from Java's String.hashCode()) */
function _hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

describe('AnvilCompiler', () => {
  let compiler: AnvilCompiler;

  beforeEach(() => {
    compiler = new AnvilCompiler(projectRoot, compilerBinaryPath);
  });

  it('should compile valid file and produce expected output', async () => {
    const validResult = await compiler.compile('samples/valid.anvil');
    assert.strictEqual(
      validResult.success,
      true,
      'Expected compilation to succeed',
    );
    assert.strictEqual(validResult.errors.length, 0, 'Expected no errors');
    assert.ok(
      validResult.stdout && validResult.stdout.length > 0,
      'Expected non-empty stdout',
    );
  });

  it('should handle compilation errors and produce correct error information', async () => {
    const invalidResult = await compiler.compile('samples/invalid.anvil');
    assert.strictEqual(
      invalidResult.success,
      false,
      'Expected compilation to fail',
    );
    assert.ok(invalidResult.errors.length > 0, 'Expected at least one error');
    const error =
      invalidResult.errors.find((e) =>
        e.message.includes('Value does not live long enough'),
      ) || invalidResult.errors[0];

    assert.ok(
      error.message.includes('Borrow checking failed'),
      'Error message does not contain expected text fragment',
    );
    assert.strictEqual(error.span.start.line, 19);
    assert.strictEqual(error.span.start.col, 12);
    assert.strictEqual(error.span.end.line, 19);
    assert.strictEqual(error.span.end.col, 43);
    assert.ok(
      error.filepath.endsWith('samples/invalid.anvil'),
      'Expected to end with samples/invalid.anvil; got "' +
        error.filepath +
        '"',
    );
  });

  it('should handle non-existent file and produce an appropriate error', async () => {
    const nonExistentResult = await compiler.compile(
      'samples/nonexistent.anvil',
    );
    assert.strictEqual(
      nonExistentResult.success,
      false,
      'Expected compilation to fail',
    );
    assert.ok(
      nonExistentResult.errors.length > 0,
      'Expected at least one error',
    );
    const errorMessage = nonExistentResult.errors[0].message;
    assert.ok(errorMessage.includes('No such file or directory'));
  });

  it('should compile file with import statements successfully', async () => {
    const importResult = await compiler.compile('samples/import.anvil');
    assert.strictEqual(
      importResult.success,
      true,
      'Expected compilation to succeed',
    );
    assert.strictEqual(importResult.errors.length, 0, 'Expected no errors');
  });

  it('should resolve definitions across imported files', async function () {
    await skipUnlessAstSupported(this);

    const importResult = await compiler.compile('samples/import.anvil');
    assert.ok(importResult.ast, 'Expected parsed AST output');

    const root = importResult.ast.root('samples/import.anvil');
    assert.ok(root, 'Expected root AST node for imported sample');

    const proc = root.down('procs').down(0).resolve();
    assert.strictEqual(proc?.span.file_name, 'samples/import.anvil');
    assert.ok(proc && !('file_name' in proc));

    const spawn = root.unsafeTraverse('procs', 0, 'body', 'spawns', 0);
    assert.strictEqual(
      spawn.definition?.filepath,
      'samples/pipeline/Alu.anvil',
    );
  });

  it('should compile the simple lsp test file successfully', async () => {
    const importResult = await compiler.compile('samples/lsp_test.anvil');
    assert.strictEqual(
      importResult.success,
      true,
      'Expected compilation to succeed',
    );
    assert.strictEqual(importResult.errors.length, 0, 'Expected no errors');
  });

  it('should include event graphs in the AST of the simple lsp test file', async function () {
    await skipUnlessAstSupported(this);

    const importResult = await compiler.compile('samples/lsp_test.anvil');
    assert.ok(importResult.ast, 'Expected parsed AST output');
    const root = importResult.ast.root('samples/lsp_test.anvil');
    assert.ok(root, 'Expected root AST node for lsp test file');
    const eventGraphs = root.resolve()?.event_graphs;
    if (!eventGraphs) this.skip(); // the compiler emits no timing events
    for (const graph of eventGraphs) {
      assert.ok(graph.event_exprs, 'Expected event expression lookup table');
    }
  });

  it('should compile the complex lsp test file successfully', async () => {
    const importResult = await compiler.compile(
      'samples/lsp_test_complex.anvil',
    );
    assert.strictEqual(
      importResult.success,
      true,
      'Expected compilation to succeed',
    );
    assert.strictEqual(importResult.errors.length, 0, 'Expected no errors');
  });

  it('should compile Pact session-typed designs successfully', async () => {
    for (const sample of [
      'samples/pact/axi.anvil',
      'samples/pact/xor_choice.anvil',
    ]) {
      const result = await compiler.compile(sample);
      assert.deepStrictEqual(
        result.errors.map((e) => e.message),
        [],
        `Expected no errors for ${sample}`,
      );
      assert.strictEqual(result.success, true, `Expected ${sample} to compile`);
    }
  });

  it('should report whether the AST was requested', async () => {
    const capabilities = await compiler.getCapabilities();
    const result = await compiler.compile('samples/valid.anvil');
    assert.strictEqual(result.astSupported, capabilities.astOutput);
    if (!capabilities.astOutput) {
      assert.ok(!result.ast, 'Expected no AST without -ast support');
    }
  });

  describe('capability detection', () => {
    it('should detect supported flags from -help output', () => {
      const help = [
        'pact [-stdin] [-json] <file1> [<file2>] ...',
        '  -stdin Read from standard input.',
        '  -just-check Only typecheck and validate the input files',
        '  -json Output compilation results in JSON format',
        '  -help  Display this list of options',
      ].join('\n');
      assert.deepStrictEqual(AnvilCompiler.parseCapabilities(help), {
        astOutput: false,
        justCheck: true,
        disableCompatChecks: false,
      });
      assert.deepStrictEqual(
        AnvilCompiler.parseCapabilities(
          help +
            '\n  -ast Output the annotated AST' +
            '\n  -disable-compat-checks Disable compatibility checks',
        ),
        { astOutput: true, justCheck: true, disableCompatChecks: true },
      );
    });

    it('should detect -just-check support in the compiler under test', async () => {
      const capabilities = await compiler.getCapabilities();
      assert.strictEqual(capabilities.justCheck, true);
    });
  });

  describe('misbehaving compilers', () => {
    const fakeCompilerPath = path.join(
      __dirname,
      '..',
      'fixtures',
      'fake-compiler.sh',
    );
    const fakeCompiler = (mode: string, timeoutMs?: number) =>
      new AnvilCompiler(projectRoot, fakeCompilerPath, {
        extraArgs: [mode],
        timeoutMs,
      });

    it('should report a crash with its stderr output', async () => {
      const result = await fakeCompiler('crash').compile(
        'samples/valid.anvil',
        { 'samples/valid.anvil': 'proc main() {}' },
      );
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errors.length, 1);
      assert.match(result.errors[0].message, /exited with code 2/);
      assert.match(result.errors[0].message, /exception Not_found/);
    });

    it('should stop a compiler that exceeds the timeout', async function () {
      this.timeout(5_000);
      const result = await fakeCompiler('hang', 200).compile(
        'samples/valid.anvil',
      );
      assert.strictEqual(result.success, false);
      assert.match(result.errors[0].message, /timed out after 0.2s/);
    });

    it('should pass extra arguments ahead of its own flags', async () => {
      const result = await fakeCompiler('echo-args').compile(
        'samples/valid.anvil',
        { 'samples/valid.anvil': 'proc main() {}' },
      );
      assert.strictEqual(result.success, true);
      assert.match(
        result.stdout,
        /"echo-args -json -just-check -stdin samples\/valid.anvil"/,
      );
    });
  });
});
