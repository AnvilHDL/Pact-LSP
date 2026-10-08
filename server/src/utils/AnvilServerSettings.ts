/**
 * Controls when Anvil syntax concept explanations (drawn from
 * ast-node-info.json) are shown to the user.  Source code, go-to-definition
 * links, and other documentation are always shown regardless of this setting.
 *
 * Accepted forms:
 *   - `true`              -> onHover: true,  onAutocomplete: "anvilKeywords"
 *   - `false`             -> onHover: false, onAutocomplete: "none"
 *   - An object with individual overrides for each surface.
 *
 * `onAutocomplete` values:
 *   - `"none"`           - Never show syntax explanations in autocomplete
 *                          popups.
 *   - `"anvilKeywords"`  - Show syntax explanations only for built-in Anvil
 *                          keywords and operators (default).
 *   - `"all"`            - Show syntax explanations for all completions,
 *                          including user-defined identifiers.
 *   - `true`             - Alias for "all".
 *   - `false`            - Alias for "none".
 */
export type ShowSyntaxHelp =
  | boolean
  | {
      onHover?: boolean;
      onAutocomplete?: 'none' | 'anvilKeywords' | 'all' | boolean;
      includeExamples?: boolean;
    };

/** Fully-resolved, normalised form of ShowSyntaxHelp. */
export interface ResolvedShowSyntaxHelp {
  onHover: boolean;
  onAutocomplete: 'none' | 'anvilKeywords' | 'all';
  includeExamples: boolean;
}

/**
 * Normalise any accepted ShowSyntaxHelp value into the canonical resolved form.
 * Missing fields fall back to the defaults: onHover=true, onAutocomplete="anvilKeywords", includeExamples=false.
 */
export function resolveShowSyntaxHelp(
  raw: ShowSyntaxHelp | undefined,
): ResolvedShowSyntaxHelp {
  if (raw === undefined || raw === null) {
    return {
      onHover: true,
      onAutocomplete: 'anvilKeywords',
      includeExamples: false,
    };
  }
  if (typeof raw === 'boolean') {
    return {
      onHover: raw,
      onAutocomplete: raw ? 'anvilKeywords' : 'none',
      includeExamples: false,
    };
  }
  const onAutocomplete = (() => {
    const v = raw.onAutocomplete;
    if (v === true) return 'all' as const;
    if (v === false) return 'none' as const;
    if (v === 'anvilKeywords' || v === 'all' || v === 'none') return v;
    return 'anvilKeywords' as const;
  })();
  return {
    onHover: raw.onHover ?? true,
    onAutocomplete,
    includeExamples: raw.includeExamples ?? false,
  };
}

/**
 * Controls how clock-cycle timing and lifetime information for expressions is
 * surfaced in the editor.
 *
 * Accepted forms:
 *   - `true`   -> asInlayHints: "condensed", onHover: true,  includeUnknownVariableDefinitions: true,  onAutocomplete: true
 *   - `false`  -> asInlayHints: "none",      onHover: false, includeUnknownVariableDefinitions: false, onAutocomplete: false
 *   - An object with individual overrides for each surface.
 *
 * `asInlayHints` values:
 *   - `"none"`       - Do not show timing info as inlay hints.
 *   - `"condensed"`  - Show timing info as compact prefix inlay hints with
 *                      block markers (default).
 *   - `"full"`       - Show timing info as inlay hints with full detail on
 *                      every line.
 *   - `true`         - Alias for "condensed".
 *   - `false`        - Alias for "none".
 *
 * `includeUnknownVariableDefinitions`:
 *   - `true`          - Include unresolved remainder symbols in the timing
 *                       variable definitions block (default).
 *   - `false`         - Show only known timing variable definitions.
 */
export type ShowTimingInfo =
  | boolean
  | {
      asInlayHints?: boolean | 'none' | 'condensed' | 'full';
      onHover?: boolean;
      includeUnknownVariableDefinitions?: boolean;
      onAutocomplete?: boolean;
    };

/** Fully-resolved, normalised form of TimingInfo. */
export interface ResolvedShowTimingInfo {
  asInlayHints: 'none' | 'condensed' | 'full';
  onHover: boolean;
  includeUnknownVariableDefinitions: boolean;
  onAutocomplete: boolean;
}

/**
 * Normalise any accepted TimingInfo value into the canonical resolved form.
 * Missing fields fall back to the defaults: asInlayHints="condensed", onHover=true, includeUnknownVariableDefinitions=true, onAutocomplete=true.
 */
export function resolveTimingInfo(
  raw: ShowTimingInfo | undefined,
): ResolvedShowTimingInfo {
  if (raw === undefined || raw === null) {
    return {
      asInlayHints: 'condensed',
      onHover: true,
      includeUnknownVariableDefinitions: true,
      onAutocomplete: true,
    };
  }
  if (typeof raw === 'boolean') {
    return {
      asInlayHints: raw ? 'condensed' : 'none',
      onHover: raw,
      includeUnknownVariableDefinitions: raw,
      onAutocomplete: raw,
    };
  }
  const asInlayHints = (() => {
    const v = raw.asInlayHints;
    if (v === true) return 'condensed' as const;
    if (v === false) return 'none' as const;
    if (v === 'none' || v === 'condensed' || v === 'full') return v;
    return 'condensed' as const;
  })();
  return {
    asInlayHints,
    onHover: raw.onHover ?? true,
    includeUnknownVariableDefinitions:
      raw.includeUnknownVariableDefinitions ?? true,
    onAutocomplete: raw.onAutocomplete ?? true,
  };
}

/**
 * Controls where the remaining session type of session-checked threads is shown.
 *
 * Accepted forms:
 *   - `true`   -> asInlayHints: true,  onHover: true
 *   - `false`  -> asInlayHints: false, onHover: false
 *   - object   -> missing fields default to `true`
 */
export type ShowSessionState =
  | boolean
  | {
      asInlayHints?: boolean;
      onHover?: boolean;
    };

export interface ResolvedShowSessionState {
  asInlayHints: boolean;
  onHover: boolean;
}

export function resolveSessionState(
  raw: ShowSessionState | undefined,
): ResolvedShowSessionState {
  if (raw === undefined) return { asInlayHints: true, onHover: true };
  if (typeof raw === 'boolean') return { asInlayHints: raw, onHover: raw };
  return {
    asInlayHints: raw.asInlayHints ?? true,
    onHover: raw.onHover ?? true,
  };
}

export interface AnvilServerSettings {
  maxNumberOfProblems?: number;
  projectRoot?: string;
  executablePath?: string;
  /** Extra flags passed to the compiler, e.g. `-strict-dtc`. */
  compilerArgs?: string[];
  /** Run pool compatibility checks; off unless the user enables them, since they can be slow. */
  compatibilityChecks?: boolean;
  /** Milliseconds before a compiler run is stopped; 0 disables the limit. */
  compileTimeout?: number;
  asciiOnlyIcons?: boolean;
  snippets?: { fancy?: boolean };
  showTimingInfo?: ShowTimingInfo;
  showSyntaxHelp?: ShowSyntaxHelp;
  showSessionState?: ShowSessionState;
  debug?: boolean;
}

export const DEFAULT_ANVIL_SERVER_SETTINGS: AnvilServerSettings = {
  maxNumberOfProblems: 1000,
  compatibilityChecks: false,
  asciiOnlyIcons: false,
  showTimingInfo: {
    asInlayHints: 'condensed',
    onHover: true,
    includeUnknownVariableDefinitions: true,
    onAutocomplete: true,
  },
  showSyntaxHelp: { onHover: true, onAutocomplete: 'anvilKeywords' },
  showSessionState: { asInlayHints: true, onHover: true },
};
