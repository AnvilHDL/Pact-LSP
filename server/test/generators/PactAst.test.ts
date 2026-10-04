/**
 * Integration tests for Pact constructs in the compiler's AST output:
 * navigation through interfaces, pools and session types, endpoint completion
 * in interface-typed processes, and session state hints.
 *
 * Positions are 0-based LSP positions; spans in the AST use 1-based lines.
 */

import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, before } from 'mocha';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { AnvilDocument } from '../../src/core/AnvilDocument';
import { AnvilAstNode } from '../../src/core/ast/AnvilAst';
import { AnvilProcSchema } from '../../src/core/ast/schema';
import { processEndpointNodes } from '../../src/core/ast/pact';
import { AnvilCompletionGenerator } from '../../src/generators/AnvilCompletionGenerator';
import { AnvilDescriptionGenerator } from '../../src/generators/AnvilDescriptionGenerator';
import { AnvilInlayHintGenerator } from '../../src/generators/AnvilInlayHintGenerator';
import { AnvilServerSettings } from '../../src/utils/AnvilServerSettings';
import {
  compilerBinaryPath,
  projectRoot,
  skipUnlessAstSupported,
} from '../testCompiler';

const settings = {
  projectRoot,
  executablePath: compilerBinaryPath,
} satisfies AnvilServerSettings;

const samplePath = (name: string) =>
  path.join(projectRoot, 'samples', 'pact', name);

async function compileSample(name: string): Promise<AnvilDocument> {
  const text = fs.readFileSync(samplePath(name), 'utf-8');
  const doc = AnvilDocument.fromTextDocument(
    TextDocument.create(`file://${samplePath(name)}`, 'anvil', 1, text),
  );
  await doc.compile(settings);
  assert.ok(doc.anvilAst, `${name} must produce an AST`);
  assert.deepStrictEqual(
    doc.anvilErrors?.map((e) => e.message),
    [],
    `${name} must compile without errors`,
  );
  return doc;
}

function nodeAt(doc: AnvilDocument, line: number, character: number) {
  const node = doc.getClosestAnvilNodeToLspPosition({ line, character });
  assert.ok(node, `expected a node at ${line}:${character}`);
  return node;
}

/** 1-based start lines of a node's definitions. */
const definitionLines = (node: AnvilAstNode) =>
  node.definitions.map((d) => d.span.start.line);

describe('Pact AST support', function () {
  before(async function () {
    this.timeout(15_000);
    await skipUnlessAstSupported(this);
  });

  describe('interfaces (multiprotocol.anvil)', function () {
    let doc: AnvilDocument;

    before(async function () {
      this.timeout(15_000);
      doc = await compileSample('multiprotocol.anvil');
    });

    it('links an interface in a process header to its definition', function () {
      const ref = nodeAt(doc, 10, 10); // "it1" in "proc p1 (it1, it2)"
      assert.strictEqual(ref.kind, 'interface_ref');
      assert.deepStrictEqual(definitionLines(ref), [5]);
    });

    it('links a message in an interface-typed process to the interface endpoint and the message', function () {
      const spec = nodeAt(doc, 12, 23); // "ep1.req" in "recv ep1.req"
      assert.strictEqual(spec.kind, 'message_specifier');
      assert.deepStrictEqual(definitionLines(spec), [5, 2]);
    });

    it('finds references to an interface from process headers', function () {
      const iface = nodeAt(doc, 4, 2); // "interface it1 ..."
      assert.strictEqual(iface.kind, 'interface_def');
      const refs = doc.anvilAst!.referencesTo(iface.absoluteSpan!);
      assert.deepStrictEqual(
        refs.map((r) => r.span.start.line),
        [11],
      );
    });

    it('lists the endpoints of an interface-typed process', function () {
      const proc = doc.anvilAst!.closestNode(
        doc.filepath,
        12,
        10,
        AnvilProcSchema,
      );
      assert.ok(proc);
      const endpoints = processEndpointNodes(doc.anvilAst!, proc);
      assert.deepStrictEqual(
        endpoints.map((e) => e.name),
        ['ep1', 'ep2'],
      );
    });

    it('completes endpoints and messages from the process interfaces', async function () {
      this.timeout(15_000);
      // compile, then type at the start of line 19 with the AST still from before the edit
      const complete = async (text: string) => {
        const edited = await compileSample('multiprotocol.anvil');
        const at = { line: 18, character: 8 };
        const change = { range: { start: at, end: at }, text };
        TextDocument.update(edited.textDocument, [change], 2);
        edited.syncTextEdits([change]);
        return AnvilCompletionGenerator.getCompletions(
          { line: at.line, character: at.character + text.length },
          edited,
        ).map((c) => c.label);
      };

      assert.deepStrictEqual(await complete('recv e'), ['ep1', 'ep2']);
      assert.deepStrictEqual(await complete('irecv ep1.'), ['req']);
    });
  });

  describe('pools and protocols (pool.anvil)', function () {
    let doc: AnvilDocument;

    before(async function () {
      this.timeout(15_000);
      doc = await compileSample('pool.anvil');
    });

    it('links a pool instance to the pool definition', function () {
      const inst = nodeAt(doc, 31, 10); // "pool p : my_pool;"
      assert.strictEqual(inst.kind, 'pool_inst');
      assert.deepStrictEqual(definitionLines(inst), [9]);
    });

    it('links a pool spawn to the process and the pool instance', function () {
      const spawn = nodeAt(doc, 32, 12); // "spawn worker[p.m1]"
      assert.strictEqual(spawn.kind, 'spawn_def');
      assert.deepStrictEqual(definitionLines(spawn), [15, 32]);
    });

    it('links a pool member to its interface', function () {
      const member = nodeAt(doc, 10, 5); // "m1 : i_left(a)"
      assert.strictEqual(member.kind, 'pool_member');
      assert.deepStrictEqual(definitionLines(member), [6]);
    });

    it('links messages in a channel protocol to the message definitions', function () {
      const msg = nodeAt(doc, 3, 18); // "ep.req" in "protocol :: (ep.req ; ep.ack)"
      assert.strictEqual(msg.kind, 'session_message');
      assert.deepStrictEqual(definitionLines(msg), [2]);
    });
  });

  describe('recursion (nested_rec.anvil)', function () {
    let doc: AnvilDocument;

    before(async function () {
      this.timeout(15_000);
      doc = await compileSample('nested_rec.anvil');
    });

    it('links a session variable to its binder', function () {
      const variable = nodeAt(doc, 4, 54); // "X" in "μ X . (ep.req + (#1;X))"
      assert.strictEqual(variable.kind, 'session_var');
      const [def] = variable.definitions;
      assert.strictEqual(doc.anvilAst!.node(def)?.kind, 'session_binder');
    });

    it('links recurse X to its recursive block', function () {
      const recursor = nodeAt(doc, 15, 18); // "recurse X"
      assert.strictEqual(recursor.type, 'recursor');
      assert.deepStrictEqual(definitionLines(recursor), [10]);
    });
  });

  describe('session states', function () {
    it('shows the session before and after an expression on hover', async function () {
      this.timeout(15_000);
      const doc = await compileSample('multiprotocol.anvil');
      const recv = nodeAt(doc, 12, 18); // "recv ep1.req"
      const output = AnvilDescriptionGenerator.describeNode(
        recv,
        doc,
        undefined,
        { session: true },
      );
      assert.match(output, /\*\*Session:\*\* `ep1\.req ; #1` ⟶ `#1`/);
    });

    describe('as inlay hints (offer_wildcard.anvil)', function () {
      let doc: AnvilDocument;
      const hints = (extra: AnvilServerSettings = {}) =>
        AnvilInlayHintGenerator.generateInlayHints(doc, {
          ...settings,
          showTimingInfo: false,
          ...extra,
        }).map((h) => [h.position.line, String(h.label)]);

      before(async function () {
        this.timeout(15_000);
        doc = await compileSample('offer_wildcard.anvil');
      });

      it('shows the session remaining once each offer arm is taken', function () {
        const all = hints();
        assert.ok(all.some(([l, t]) => l === 10 && t === '⟶ #5'));
        assert.ok(all.some(([l, t]) => l === 14 && t === '⟶ #3'));
        assert.ok(all.some(([l, t]) => l === 20 && t === '⟶ #5'));
      });

      it('shows when the session completes', function () {
        const all = hints();
        for (const line of [12, 17, 21]) {
          assert.ok(
            all.some(([l, t]) => l === line && t === '⟶ done'),
            `expected a completion hint on line ${line + 1}`,
          );
        }
      });

      it('uses ASCII arrows when requested', function () {
        assert.ok(
          hints({ asciiOnlyIcons: true }).some(([, t]) => t === '-> #5'),
        );
      });

      it('can be disabled', function () {
        assert.deepStrictEqual(hints({ showSessionState: false }), []);
      });
    });
  });
});
