## Pact Language Server Protocol (LSP) Support

The Pact compiler does not yet emit the annotated AST (`-ast`) that the semantic features depend on. The server detects `-ast` from the compiler's `-help` output and enables those features automatically once it is available. Until then:

**Available with the current Pact compiler:**

- ✅ Inline Diagnostics
    - ✅ Compile Errors
    - ⏳ Compile Warnings (Pact prints warnings to stderr, not in its JSON output)
- ✅ Hover Information
    - ✅ Pact keyword and operator syntax help (without AST)
    - ⏳ Definitions, types, lifetimes and timings (requires `-ast`)
- ✅ Autocompletion
    - ✅ Anvil and Pact keywords, with documentation and snippets
    - ✅ Unicode session-type operators (`\sum` → `∑`, etc.)
    - ⏳ Document symbols and context-aware suggestions (requires `-ast`)
- ✅ Syntax Highlighting (VS Code TextMate grammar and Vim syntax)
    - ✅ `interface`, `pool`, `protocol`, `offer`, `xoffer`, `isend`, `irecv`, `rec`, `forall`, `not`, `F`
    - ✅ `∑ ∏ ⨁ ⋀ ∀ ∈ μ  ̸`, `=>`, `<<`, `$`, `||`
- ⏳ Go to Definition, Go to Type Definition, Find All References (require `-ast`)
- ⏳ Signature Help (requires `-ast`)
- ⏳ Inlay Hints (requires `-ast`)
- ⏳ Pact-specific navigation (requires `-ast` covering Pact constructs)
    - ⏳ Hover, definitions and references for interfaces, pools, protocols and interface-typed procs
    - ⏳ Session-state hints: the remaining local session type at a point in a thread

## Feature Support with `-ast`

With an AST-capable compiler, the server supports the following (as inherited from anvil-lsp; Pact-specific constructs additionally need serializer support):

**Progress:**

- ✅ Inline Diagnostics
    - ✅ Compile Errors
    - ⚠️ Compile Warnings
- ✅ Hover Information
    - ✅ Definitions and types
    - ⚠️ Lifetimes and timings
    - ❌ Documentation
    - ✅ Pact syntax help
- ✅ Go to Definition
    - Requires compiler annotations for definitions.
- ⚠️ Go to Type Definition
    - Requires compiler annotations for type definitions.
- ✅ Find All References
    - Only works within the same file.
- ✅ Signature Help
    - ✅ Function call arguments (`call <identifier>(<args>)`)
    - ✅ Endpoint message send arguments (`send <endpoint>.<message>(<args>)`)
    - ✅ Record init field values (`Rec::{<field> = <value>; ... }`)
    - ✅ Spawn process arguments (`spawn <proc>(<args>)`)
- ✅ Autocompletion
    - ✅ Pact keywords
    - ✅ Document symbols
    - ✅ Context-aware suggestions
        - ✅ Function call syntax (`call <identifier>(<args>)`)
        - ✅ Endpoint message send/receive (`send`/`recv`) syntax
        - ✅ Register read (`*`) syntax
        - ✅ Register assign (`set`) syntax
        - ✅ Enum value syntax (`Enum::value`) syntax
        - ❌ Record init (`Rec::{field =`) syntax
        - ⏳ Record read (`.field`) syntax
        - ✅ Type annotation syntax (`<identifier> : <type>`)
        - ✅ Lifetime annotation syntax (`chan { <left/right> ... : <lifetime> }`)
        - ⏳ Datatype-matched parameter values
    - ✅ Snippets
        - ✅ Automatic delimiter insertion
        - ✅ Function call snippet (`call <identifier>(<args>)`)
        - ✅ Record init snippet (`Rec::{<field> = <value>; ... }`)
        - ✅ Spawn process snippet (`spawn <proc>(<args>)`)
- ✅ Inlay Hints
    - ⚠️ Lifetime and timings
        - ⚠️ Clock Cycle indicators
        - ⚠️ Lifetime indicators
- ⏳ Rename/Refactor symbol
    - Requires compiler annotations for all symbol reference locations.

**Legend:**
- ✅ Supported and operational
- ⚠️ Supported by language server; requires compiler updates to be fully operational
- ⚙️ WIP / incomplete support
- ⏳ Not supported; requires compiler updates to implement support
- ❌ Not supported
