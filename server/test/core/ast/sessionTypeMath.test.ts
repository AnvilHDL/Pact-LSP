import assert from 'node:assert';
import { describe, it } from 'mocha';

import {
  sessionTypeLines,
  sessionTypeMath,
} from '../../../src/core/ast/sessionTypeMath';

type Json = Record<string, unknown>;

const st = (type: string, fields: Json = {}): Json => ({
  kind: 'session_type',
  type,
  ...fields,
});
const msg = (endpoint: string, m: string, blocking = true): Json => ({
  kind: 'session_action',
  type: 'message',
  blocking,
  msg_spec: { kind: 'message_specifier', endpoint, msg: m },
});
const atom = (action: Json) => st('atom', { action });
const delay = (cycles: number): Json => ({
  kind: 'session_action',
  type: 'delay',
  cycles,
});
const arm = (trigger: Json, continuation: Json | null = null): Json => ({
  kind: 'session_offering',
  trigger,
  continuation,
});

describe('sessionTypeMath', () => {
  it('renders word operators in mathematical notation', () => {
    // rec X . ^(ep.req : #1, * : #1 ; X) || (a.x ++ a.y)
    const body = st('seq', {
      first: atom(delay(1)),
      then: st('var', { id: 'X' }),
    });
    const t = st('parallel', {
      left: st('rec', {
        id: 'X',
        body: st('xoffer', {
          arms: [arm(msg('ep', 'req'), atom(delay(1))), arm(delay(0), body)],
        }),
      }),
      right: st('fair_choice', {
        left: atom(msg('a', 'x')),
        right: atom(msg('a', 'y')),
      }),
    });
    assert.strictEqual(
      sessionTypeMath(t),
      '(μX. ⨁(ep.req : #1, * : #1 ; X)) ∥ a.x +ᶠ a.y',
    );
  });

  it('renders offers, fair offers and instant messages', () => {
    const offer = st('offer', {
      arms: [arm(msg('ep', 'a', false)), arm(msg('ep', 'b', false))],
    });
    const fair = st('fair_xoffer', { arms: [arm(msg('ep', 'c'))] });
    assert.strictEqual(sessionTypeMath(offer), '⋀(#ep.a, #ep.b)');
    assert.strictEqual(sessionTypeMath(fair), '⨁ᶠ(ep.c)');
  });

  it('parenthesizes by precedence', () => {
    // (a + b) ; F c
    const t = st('seq', {
      first: st('choice', {
        left: atom(msg('ep', 'a')),
        right: atom(msg('ep', 'b')),
      }),
      then: st('future', { body: atom(msg('ep', 'c')) }),
    });
    assert.strictEqual(sessionTypeMath(t), 'ep.a + ep.b ; F ep.c');
    // (a ; b) + c
    const u = st('choice', {
      left: st('seq', {
        first: atom(msg('ep', 'a')),
        then: atom(msg('ep', 'b')),
      }),
      right: atom(msg('ep', 'c')),
    });
    assert.strictEqual(sessionTypeMath(u), '(ep.a ; ep.b) + ep.c');
  });

  it('renders data-sensitive types', () => {
    // (rec X[c : [0,255]] . if (c > 0) { #ep.beat ; X[c - 1] } else { () })[n]
    const payload = (action: Json, p: string): Json => ({
      kind: 'session_action',
      type: 'payload',
      action,
      payload: p,
    });
    const loop = st('rec_data', {
      id: 'X',
      params: [{ name: 'c', domain: '[0,255]' }],
      args: ['n'],
      body: st('if', {
        cond: '(c > 0)',
        then: st('seq', {
          first: atom(msg('ep', 'beat', false)),
          then: st('call', { id: 'X', args: ['(c - 1)'] }),
        }),
        else: st('skip'),
      }),
    });
    const t = st('seq', {
      first: atom(payload(msg('ep', 'len', false), '(n)')),
      then: loop,
    });
    assert.strictEqual(
      sessionTypeMath(t),
      '#ep.len(n) ; (μX[c : [0,255]]. if (c > 0) { #ep.beat ; X[(c - 1)] } else { () })[n]',
    );
    assert.strictEqual(
      sessionTypeMath(atom(payload(msg('ep', 'req'), '<3>'))),
      'ep.req<3>',
    );
  });

  it('breaks long types over lines', () => {
    // rec X . ^(ep.req : #1 ; ep.rsp ; #1 ; X, * : #1 ; X)
    const t = st('rec', {
      id: 'X',
      body: st('xoffer', {
        arms: [
          arm(
            msg('ep', 'request_with_a_long_name'),
            st('seq', {
              first: atom(delay(1)),
              then: st('seq', {
                first: atom(msg('ep', 'response_with_a_long_name')),
                then: st('var', { id: 'X' }),
              }),
            }),
          ),
          arm(
            delay(0),
            st('seq', { first: atom(delay(1)), then: st('var', { id: 'X' }) }),
          ),
        ],
      }),
    });
    assert.strictEqual(sessionTypeLines(t, 200), sessionTypeMath(t));
    assert.strictEqual(
      sessionTypeLines(t, 40),
      [
        'μX. ⨁(',
        '  ep.request_with_a_long_name : #1 ;',
        '    ep.response_with_a_long_name ;',
        '    X,',
        '  * : #1 ; X',
        ')',
      ].join('\n'),
    );
  });

  it('renders quantifiers', () => {
    const t = st('forall', {
      op: 'parallel',
      id: 'i',
      range: { from: 1, to: 3 },
      excluded: [2],
      body: atom(msg('ep', 'req')),
    });
    assert.strictEqual(sessionTypeMath(t), '∀ (i ∈ [1..3] ̸ 2) ∏ { ep.req }');
  });
});
