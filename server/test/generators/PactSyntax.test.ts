/**
 * Tests for Pact syntax support that works without compiler AST output:
 * Unicode operator completion, Pact keyword completion, keyword hover help,
 * and document state when the compiler cannot emit an AST.
 */

import assert from 'node:assert';
import * as path from 'path';
import { describe, it } from 'mocha';
import { CompletionItem, Position, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { AnvilDocument } from '../../src/core/AnvilDocument';
import { AnvilCompletionGenerator } from '../../src/generators/AnvilCompletionGenerator';
import { AnvilDescriptionGenerator } from '../../src/generators/AnvilDescriptionGenerator';
import { completionInfo } from '../../src/info/parsed';
import { compilerBinaryPath, projectRoot } from '../testCompiler';

const NOT_SYMBOL = ' ̸';

function docOf(text: string): AnvilDocument {
  return AnvilDocument.fromTextDocument(
    TextDocument.create('file:///tmp/pact-test.anvil', 'anvil', 0, text),
  );
}

/** Completion items at the end of the given single-line text. */
function completeAtEnd(text: string): CompletionItem[] {
  const position: Position = { line: 0, character: text.length };
  return AnvilCompletionGenerator.getCompletions(position, docOf(text)).map(
    (c) => c.lspCompletionItem(),
  );
}

/** Applies an item's text edit to a single-line text. */
function applyEdit(text: string, item: CompletionItem): string {
  const edit = item.textEdit as TextEdit;
  return (
    text.slice(0, edit.range.start.character) +
    edit.newText +
    text.slice(edit.range.end.character)
  );
}

describe('Pact syntax support', function () {
  describe('Unicode operator completion', function () {
    it('offers every operator by trigger after a backslash', function () {
      const items = completeAtEnd('interface i (ep : left ch) = \\');
      const labels = items.map((i) => i.label);
      for (const op of completionInfo.knownUnicodeOperators) {
        for (const trigger of op.triggers) {
          assert.ok(labels.includes(`\\${trigger}`), `missing \\${trigger}`);
        }
      }
    });

    it('replaces the typed trigger with the symbol', function () {
      const text = 'interface i (ep : left ch) = \\su';
      const sum = completeAtEnd(text).find((i) => i.label === '\\sum');
      assert.ok(sum, 'expected \\sum');
      assert.strictEqual(sum.filterText, '\\sum');
      assert.strictEqual(
        applyEdit(text, sum),
        'interface i (ep : left ch) = ∑',
      );
    });

    it('absorbs whitespace before the exclusion symbol', function () {
      for (const text of [
        'forall (i : [1..5]\\no',
        'forall (i : [1..5] \\no',
        'forall (i : [1..5]   \\no',
      ]) {
        const not = completeAtEnd(text).find((i) => i.label === '\\not');
        assert.ok(not, `expected \\not for "${text}"`);
        assert.strictEqual(
          applyEdit(text, not),
          `forall (i : [1..5]${NOT_SYMBOL}`,
        );
        const edit = not.textEdit as TextEdit;
        assert.strictEqual(
          not.filterText,
          text.slice(edit.range.start.character, text.lastIndexOf('\\')) +
            '\\not',
        );
      }
    });

    it('does not offer operators inside string literals', function () {
      const labels = completeAtEnd('dprint "line\\').map((i) => i.label);
      assert.ok(!labels.some((l) => l.startsWith('\\')));
    });

    it('defines an ASCII equivalent for every operator', function () {
      for (const op of completionInfo.knownUnicodeOperators) {
        assert.ok(op.ascii, `${op.symbol} has no ASCII equivalent`);
        assert.ok(op.description, `${op.symbol} has no description`);
      }
    });
  });

  describe('keyword completion without an AST', function () {
    it('includes Pact keywords with documentation', function () {
      const items = completeAtEnd('    ');
      for (const keyword of [
        'interface',
        'pool',
        'protocol',
        'offer',
        'xoffer',
        'isend',
        'irecv',
        'rec',
        'forall',
      ]) {
        const item = items.find((i) => i.label === keyword);
        assert.ok(item, `missing keyword ${keyword}`);
        assert.ok(item.data?.desc, `keyword ${keyword} has no description`);
      }
    });

    it('does not offer the removed foreign keyword', function () {
      assert.strictEqual(completionInfo.getKeywordMetadata('foreign'), null);
    });
  });

  describe('keyword hover', function () {
    it('describes Pact keywords', function () {
      const desc = AnvilDescriptionGenerator.describeKeyword('xoffer');
      assert.ok(desc);
      assert.match(desc, /\*\*Pact Info:\*\*/);
      assert.match(desc, /exactly one/);
    });

    it('merges the descriptions of keyword variants', function () {
      const desc = AnvilDescriptionGenerator.describeKeyword('pool');
      assert.ok(desc);
      assert.match(desc, /Declares a \*\*pool\*\*/);
      assert.match(desc, /Instantiates a \*\*pool\*\*/);
    });

    it('describes Unicode operators with their ASCII form', function () {
      const desc = AnvilDescriptionGenerator.describeKeyword('⨁');
      assert.ok(desc);
      assert.match(desc, /ASCII: `\^`/);
    });

    it('describes the exclusion symbol from its combining character', function () {
      const desc = AnvilDescriptionGenerator.describeKeyword('̸');
      assert.ok(desc);
      assert.match(desc, /ASCII: `not`/);
    });

    it('returns null for unknown tokens', function () {
      assert.strictEqual(
        AnvilDescriptionGenerator.describeKeyword('not_a_keyword'),
        null,
      );
    });

    it('finds Unicode symbols under the cursor', function () {
      const doc = docOf('interface i (ep : left ch) = ∑(ep.req, #1)');
      const at = (character: number) =>
        doc.getTokenAtLspPosition({ line: 0, character });
      assert.strictEqual(at(29), '∑');
      assert.strictEqual(at(30), '(');
      assert.strictEqual(at(5), 'interface');
    });
  });

  describe('document state without AST support', function () {
    const settings = { projectRoot, executablePath: compilerBinaryPath };
    const fullPath = path.join(projectRoot, 'samples/pact/multiprotocol.anvil');

    it('does not recompile on demand once the compiler lacks -ast', async function () {
      this.timeout(15_000);
      const doc = AnvilDocument.fromFilesystem(fullPath)!;
      await doc.compile(settings);
      if (doc.astSupported !== false) this.skip();

      assert.strictEqual(doc.isResultsUpToDate, true);
      assert.deepStrictEqual(doc.anvilErrors, []);

      let compiles = 0;
      const compile = doc.compile.bind(doc);
      doc.compile = async (s) => {
        compiles++;
        return compile(s);
      };
      assert.strictEqual(await doc.ensureAst(settings), null);
      assert.strictEqual(compiles, 0);
    });
  });
});
