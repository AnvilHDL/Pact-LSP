<p align="center">
  <a href="https://anvil.kisp-lab.org/" aria-label="AnvilHDL website">
    <img alt="AnvilHDL" src="assets/anvilhdl-logo.png" height="84">
  </a>
</p>

# Pact Language Server

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) implementation for [Pact](https://github.com/arj4web/Pact), the session-typed extension of [AnvilHDL](https://github.com/AnvilHDL/anvil), with extensions for VS Code and Vim/Neovim (coc.nvim). It is derived from the [Anvil Language Server](https://github.com/AnvilHDL/anvil-lsp).

> [!NOTE]
> The language server is experimental. Features that depend on the compiler's AST output (`-ast`) are enabled automatically when the compiler provides it.

## Features

| Feature | Support |
| --- | --- |
| Diagnostics | Compile errors, including session-type errors |
| Completion | Keywords with documentation; Unicode session-type operators; endpoints, messages and symbols in context¹ |
| Hover | Syntax help; definitions, types and message timing contracts¹ |
| Navigation | Go to definition and find references across interfaces, pools, protocols, processes, channels, registers and types¹ |
| Session states | The remaining session type of each thread, as inlay hints and on hover¹ |
| Process types | Each process's type above its definition: its declared interfaces, or else the type inferred from its threads, always in mathematical notation; next to it, the data-sensitive type inferred from the process, with the registers and payloads it tracks. Long types are named in the lens; hovering the process shows both over several lines² |
| Signature help | Function calls, message sends, record initialisers and spawns¹ |
| Highlighting | All Pact keywords and operators (VS Code and Vim) |
| Timing | Clock-cycle inlay hints and expression lifetimes are not yet available for Pact |

¹ Requires a Pact compiler with AST output (`-ast`). Without it, diagnostics, keyword completion, syntax help and highlighting remain available.

² Requires a Pact compiler that emits `process_type`; the data-sensitive type needs one with the data-sensitive extension (the `hybrid-pact` branch). Shown as a code lens; turn it off with `pact.showProcessTypes`. In coc.nvim, enable `codeLens.enable`.

See [LSP.md](LSP.md) for the detailed feature matrix.

### Unicode operators

Type a backslash followed by the operator name to insert its symbol. Each symbol has an ASCII equivalent.

| Input | Symbol | ASCII | Meaning |
| --- | --- | --- | --- |
| `\sum` | `∑` | `+` | Choice |
| `\prod` | `∏` | `\|\|` | Parallel composition |
| `\and`, `\wedge` | `⋀` | `&` | Offer |
| `\xor`, `\oplus` | `⨁` | `^` | Exclusive offer |
| `\fxor`, `\foplus` | `⨁ᶠ` | `^^` | Fair exclusive offer |
| `\fplus`, `\fsum` | `+ᶠ` | `++` | Fair choice |
| `\forall` | `∀` | `forall` | Quantifier |
| `\in` | `∈` | `:` | Quantifier range |
| `\mu`, `\rec` | `μ` | `rec` | Recursion |
| `\not` | ` ̸` | `not` | Range exclusion |

The exclusion symbol is a single space followed by U+0338; completing `\not` replaces any whitespace before it.

## Requirements

- [Node.js](https://nodejs.org/) 22 or later.
- The Pact compiler, commit [`f0115c7`](https://github.com/arj4web/Pact/tree/overhead-inspection) or later. AST output (`-ast`) is available on the `pact-ast` branch. The `pact` submodule pins a version without AST output.

## Installation

### Compiler

```bash
git clone --recurse-submodules <repository-url> pact-lsp
cd pact-lsp/pact
eval $(opam env) && dune build --release && dune install
```

To use another Pact build, set `pact.executablePath` to its binary.

### VS Code

```bash
cd pact-lsp/extensions/vscode
npm install && npm run build
```

Then run **Developer: Install Extension from Location...** from the Command Palette and select `extensions/vscode`.

### Vim/Neovim (coc.nvim)

Build `extensions/vim` with `npm install && npm run build` and add it to the runtime path:

```vim
set rtp^=/path/to/pact-lsp/extensions/vim
```

The Pact and Anvil extensions both handle `.anvil` files. Enable only one of them per workspace.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `pact.executablePath` | `pact` on `PATH` | Path to the compiler. |
| `pact.compilerArgs` | `[]` | Additional compiler flags, e.g. `["-disable-lt-checks"]`. |
| `pact.compatibilityChecks` | `false` | Run pool compatibility checks during diagnostics. They can take minutes on large pools, so they run only when enabled. |
| `pact.compileTimeout` | `15000` | Milliseconds before a compiler run is stopped; `0` disables the limit. |
| `pact.projectRoot` | Workspace root | Directory in which the compiler runs. |
| `pact.maxNumberOfProblems` | `100` | Maximum number of diagnostics per file. |
| `pact.showTimingInfo` | Condensed inlay hints and hover | Where clock-cycle and lifetime information is shown (not yet emitted by Pact). |
| `pact.showSyntaxHelp` | Hover and keyword completions | Where explanations of Pact syntax are shown. |
| `pact.showSessionState` | Inlay hints and hover | Where the remaining session type is shown. |
| `pact.asciiOnlyIcons` | `false` | Use ASCII characters instead of Unicode symbols. |

## Development

```bash
./build.sh    # compiler, server and extensions
./test.sh
./format.sh
./update.sh   # pull this repository and resynchronise submodules
```

Each script accepts component names (`pact`, `server`, `vscode`, `vim`) to limit it to those components. To test against another compiler build, set `PACT_BIN`, e.g. `cd server && PACT_BIN=/path/to/pact npm test`. See [MAINTAINERS.md](MAINTAINERS.md) for the architecture and maintenance guide.
