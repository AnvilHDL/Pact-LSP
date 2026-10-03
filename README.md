# pact-lsp

[Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) implementation for [Pact](https://github.com/arj4web/Pact), the session-typed extension of the [Anvil](https://github.com/kisp-nus/anvil) hardware description language, with prepared extensions for supported editors.

This is a fork of [anvil-lsp](https://github.com/AnvilHDL/anvil-lsp). It understands Pact's additions (interfaces, pools, protocols, offers, instantaneous messages, recursion and the Unicode session-type operators) and drives the `pact` compiler instead of `anvil`.

## Requires

- The Pact compiler, [`f0115c7` or later](https://github.com/arj4web/Pact/tree/overhead-inspection). The pinned version is included as a submodule in this repository. Earlier versions write debug `.dot` files into your project on every compile.
- [Node.js](https://nodejs.org/en) version 22 or later.

To install the language server, view the [installation instructions](#language-server-installation) for your editor of choice. To build the pinned compiler, view the [Pact installation instructions](#pact-installation).

If you want to develop or maintain this repository, see the [maintainer guide](MAINTAINERS.md).

---

## Feature Support

The language server works in two tiers, depending on what the compiler provides:

- **With any supported Pact compiler** (available now):
    - [x] Inline diagnostics for compile errors (syntax, type, borrow, lifetime and session-type errors)
    - [x] Syntax highlighting for all Pact keywords and operators
    - [x] Keyword completion with documentation, including every Pact construct
    - [x] Unicode operator input: type `\sum`, `\prod`, `\xor`, `\and`, `\forall`, `\in`, `\mu` or `\not` to insert `∑ ∏ ⨁ ⋀ ∀ ∈ μ  ̸`
    - [x] Hover help for keywords and Unicode operators, including their ASCII equivalents
- **With a Pact compiler that supports `-ast`** (not yet available; turns on automatically once the compiler has it):
    - [ ] Hover information for definitions, types, lifetimes and timings
    - [ ] Go to definition / type definition, find all references
    - [ ] Context-aware completion and signature help
    - [ ] Inlay hints for clock cycles and lifetimes
    - [ ] Navigation for interfaces, pools and session definitions; session-state hints

Pact currently prints warnings to stderr rather than including them in its JSON output, so warnings are not shown in the editor yet.

For details, see the [LSP feature support documentation](LSP.md).

### Unicode operators

Each operator has an ASCII equivalent, so the Unicode forms are optional:

| Type | Inserts | ASCII equivalent | Meaning |
| --- | --- | --- | --- |
| `\sum` | `∑` | `+` | n-ary choice |
| `\prod` | `∏` | `\|\|` | n-ary parallel composition |
| `\and`, `\wedge` | `⋀` | `&` | offer |
| `\xor`, `\oplus` | `⨁` | `^` | exclusive offer |
| `\forall` | `∀` | `forall` | quantifier |
| `\in` | `∈` | `:` | quantifier range binder |
| `\mu`, `\rec` | `μ` | `rec` | recursion |
| `\not` | ` ̸` | `not` | exclusion from a quantifier range |

The exclusion symbol is lexed as exactly one space followed by U+0338, so completing `\not` also replaces any whitespace before it.

---

## Language Server Installation

Extensions are experimental. They integrate syntax highlighting and LSP support for `.anvil` files.

The Pact extensions use the same `anvil` language ID and `.anvil` file extension as the Anvil extensions, so **install either the Anvil or the Pact extension, not both active at once**. If you work on both languages, disable one of them per workspace (in VS Code: right-click the extension → **Disable (Workspace)**).

Available extensions for supported editors are included in the `extensions` folder.

- [VSCode](#vscode)
- [Vim/Neovim (`coc.nvim`)](#vimneovim-cocnvim)

### VSCode

1. Clone this repository, and build the extension:
    ```bash
    git clone <repository-url> pact-lsp
    cd pact-lsp/extensions/vscode
    npm install
    npm run build
    ```

2. Open the Command Palette with `Ctrl/Cmd + Shift + P`.

3. Select **"Developer: Install Extension from Location..."**.

4. Navigate to this repository, then into `extensions`, and then `vscode`.

5. Select **"Open"** to install the extension.

### Vim/Neovim (coc.nvim)

This requires `coc.nvim` for out-of-the-box LSP support.

1. Clone this repository, and build the extension:
    ```bash
    git clone <repository-url> pact-lsp
    cd pact-lsp/extensions/vim
    npm install
    npm run build
    ```

2. Add the following to your `.vimrc` or `init.vim`:
    ```vim
    set rtp^=/path/to/pact-lsp/extensions/vim
    ```

### Settings

All settings live under the `pact` namespace (`coc-settings.json` for coc.nvim):

| Setting | Default | Description |
| --- | --- | --- |
| `pact.executablePath` | `pact` on your `PATH` | Path to the Pact compiler binary. |
| `pact.compilerArgs` | `[]` | Extra compiler flags, e.g. `["-disable-compat-checks"]` or `["-strict-dtc"]`. |
| `pact.compileTimeout` | `15000` | Milliseconds before a compiler run is stopped and reported as timed out. `0` disables the limit. |
| `pact.projectRoot` | workspace root | Directory the compiler runs in. |
| `pact.maxNumberOfProblems` | `100` | Maximum number of diagnostics per file. |
| `pact.showSyntaxHelp` | on | Explanations of Pact syntax in hovers and completion popups. |
| `pact.showTimingInfo` | on | Clock-cycle and lifetime information (requires `-ast` support). |

---

## Pact Installation

The Pact compiler is required for the language server to work. This repository includes Pact as a submodule, pinned to a version known to work with the language server.

1. Clone the repository with submodules:
    ```bash
    git clone --recurse-submodules <repository-url> pact-lsp
    ```

   If you have already cloned it without submodules, you can retrieve them like so:
    ```bash
    git submodule update --init --recursive
    ```

2. Build and install the pinned Pact version:
    ```bash
    cd pact-lsp/pact
    eval $(opam env) && dune build --release && dune install
    ```

To use your own Pact checkout instead, point `pact.executablePath` at its build, e.g. `/path/to/Pact/_build/default/bin/main.exe`.

---

## Update Scripts

You can update this repo and forcibly resync submodules as such:

```bash
# retrieves updated changes for server and submodules
./update.sh

# like above, but as separate invocations:
./update.sh server
./update.sh submodules
```

## Development Workflows

For a full repository architecture and maintainer guide, see [MAINTAINERS.md](MAINTAINERS.md).

On *nix systems, run the dev scripts in the root of the repository to format/build/test all components
(language server, Pact compiler, all editor extensions):
```bash
./format.sh
./build.sh
./test.sh
```

Or specify component(s) as argument(s) to build only said component, e.g.,
```bash
./build.sh pact vscode
```

To run the server tests against a different compiler build, set `PACT_BIN`:
```bash
cd server && PACT_BIN=/path/to/Pact/_build/default/bin/main.exe npm test
```
