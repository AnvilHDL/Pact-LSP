/**
 * Renders a session type from the compiler's JSON (`kind: "session_type"`) in
 * mathematical notation, whichever notation the source used.
 *
 * Precedence follows the compiler's printer: F > + > ∥ > ;.
 */

type Json = Record<string, unknown>;

const QUANTIFIER_SYMBOL: Record<string, string> = {
  choice: '∑',
  parallel: '∏',
  offer: '⋀',
  xoffer: '⨁',
};

function field(t: Json, key: string): Json {
  return (t[key] ?? {}) as Json;
}

function messageText(ms: Json): string {
  return `${ms.endpoint as string}.${ms.msg as string}`;
}

function actionText(a: Json): string {
  switch (a.type) {
    case 'delay':
      return a.cycles === 0 ? '*' : `#${a.cycles as number}`;
    case 'message':
      return `${a.blocking ? '' : '#'}${messageText(field(a, 'msg_spec'))}`;
    case 'terminal':
      return `$ ${sessionTypeMath(field(a, 'session_type'), 3)}`;
    case 'conjunction':
      return `{${((a.actions ?? []) as Json[]).map(actionText).join(', ')}}`;
    default:
      return '?';
  }
}

function armsText(arms: Json[]): string {
  return arms
    .map((arm) => {
      const trigger = actionText(field(arm, 'trigger'));
      const cont = arm.continuation as Json | null | undefined;
      return cont ? `${trigger} : ${sessionTypeMath(cont)}` : trigger;
    })
    .join(', ');
}

/** The session type `t` in mathematical notation. */
export function sessionTypeMath(t: Json, prec = 0): string {
  const paren = (level: number, text: string) =>
    prec > level ? `(${text})` : text;
  const sub = (key: string, p = 0) => sessionTypeMath(field(t, key), p);
  const exprs = (key: string) => ((t[key] ?? []) as string[]).join(', ');

  switch (t.type) {
    case 'skip':
      return '()';
    case 'end':
      return `$${t.id as string}`;
    case 'seq':
      return paren(0, `${sub('first', 1)} ; ${sub('then')}`);
    case 'parallel':
      return paren(1, `${sub('left', 1)} ∥ ${sub('right', 2)}`);
    case 'choice':
      return paren(2, `${sub('left', 2)} + ${sub('right', 3)}`);
    case 'fair_choice':
      return paren(2, `${sub('left', 2)} +ᶠ ${sub('right', 3)}`);
    case 'future':
      return paren(3, `F ${sub('body', 3)}`);
    case 'atom':
      return actionText(field(t, 'action'));
    case 'offer':
      return `⋀(${armsText(t.arms as Json[])})`;
    case 'xoffer':
      return `⨁(${armsText(t.arms as Json[])})`;
    case 'fair_xoffer':
      return `⨁ᶠ(${armsText(t.arms as Json[])})`;
    case 'offer_match': {
      const cases = ((t.cases ?? []) as Json[]).map((c) => {
        const on = c.on as Json[] | null;
        const label =
          on === null
            ? '*'
            : on.length === 1
              ? messageText(on[0])
              : `{${on.map(messageText).join(', ')}}`;
        return `${label} : ${sessionTypeMath(field(c, 'body'))}`;
      });
      return `⋀(${armsText(t.arms as Json[])}).(${cases.join(', ')})`;
    }
    case 'let':
      return paren(
        0,
        `let ${t.id as string} = ${sub('value', 3)} in ${sub('body', 3)}`,
      );
    case 'rec':
      return paren(0, `μ${t.id as string}. ${sub('body')}`);
    case 'var':
      return t.id as string;
    case 'forall': {
      const range = field(t, 'range');
      const excluded = (t.excluded ?? []) as number[];
      const not =
        excluded.length === 0
          ? ''
          : excluded.length === 1
            ? ` ̸ ${excluded[0]}`
            : ` ̸ (${excluded.join(', ')})`;
      const op = QUANTIFIER_SYMBOL[t.op as string] ?? '∑';
      return `∀ (${t.id as string} ∈ [${range.from as number}..${range.to as number}]${not}) ${op} { ${sub('body')} }`;
    }
    case 'rec_data': {
      const params = ((t.params ?? []) as Json[])
        .map((p) => `${p.name as string} : ${p.domain as string}`)
        .join(', ');
      return `(μ${t.id as string}[${params}]. ${sub('body')})[${exprs('args')}]`;
    }
    case 'call':
      return `${t.id as string}[${exprs('args')}]`;
    case 'if':
      return paren(
        0,
        `if ${t.cond as string} { ${sub('then')} } else { ${sub('else')} }`,
      );
    case 'probe':
      return paren(
        0,
        `if ${messageText(field(t, 'msg_spec'))} ∈ s { ${sub('then')} } else { ${sub('else')} }`,
      );
    case 'error':
      return `error(${t.reason as string})`;
    default:
      return '?';
  }
}
