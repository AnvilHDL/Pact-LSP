/**
 * Shared compiler setup for integration tests.
 */

import * as path from 'path';
import { AnvilCompiler } from '../src/core/AnvilCompiler';

export const projectRoot = path.resolve(__dirname, '../..');

/** Compiler under test: `$PACT_BIN` if set, otherwise the submodule build at `bin/pact`. */
export const compilerBinaryPath = process.env.PACT_BIN
  ? path.resolve(process.env.PACT_BIN)
  : path.join(projectRoot, 'bin', 'pact');

/**
 * Skips the calling suite when the compiler under test cannot emit an AST
 * (`-ast`), which every semantic feature (hover, completion context, inlay
 * hints, signature help) depends on.
 */
export async function skipUnlessAstSupported(
  ctx: Mocha.Context,
): Promise<void> {
  const capabilities = await new AnvilCompiler(
    projectRoot,
    compilerBinaryPath,
  ).getCapabilities();
  if (!capabilities.astOutput) {
    ctx.skip();
  }
}
