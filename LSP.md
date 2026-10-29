# Feature Support

Status of Language Server Protocol features with a Pact compiler that provides AST output (`-ast`). The language server detects `-ast` from the compiler's `-help` output; without it, only diagnostics, keyword completion, syntax help and highlighting are available.

| Status | Meaning |
| --- | --- |
| ✅ | Supported |
| ⚠️ | Implemented; requires further compiler support to be complete |
| ⏳ | Not implemented; requires compiler support |
| ❌ | Not implemented |

## Diagnostics

- ✅ Compile errors (syntax, type, borrow, lifetime and session-type errors)
- ✅ Missing imports, reported at the `import` directive, and well-formedness errors, both without losing the AST
- ⏳ Compile warnings (requires warnings in the compiler's JSON output)

## Hover

- ✅ Definitions and types
- ✅ Message timing contracts on `send`/`recv`
- ✅ Session state: the remaining session type before and after the expression
- ✅ Syntax help for Anvil and Pact keywords, constructs and Unicode operators
- ⏳ Expression lifetimes and clock cycles (requires timing events)

## Navigation

Go to definition (including into imported files) and find all references (within the file and its imports):

- ✅ Processes, functions, types, struct fields and enum variants, constants, registers
- ✅ Channel classes, endpoints and messages, including endpoints provided by a process's interfaces
- ✅ Interfaces, from process headers and pool members
- ✅ Pools and pool instances, from `pool p : T;` and `spawn P[p.m]`
- ✅ Messages, variables and binders inside session types (interfaces, pool members, channel protocols)
- ✅ `let`, `try` and offer-arm bindings; `rec X { }` blocks from `recurse X`
- ⚠️ Go to type definition
- ⏳ Rename symbol

## Signature Help

- ✅ Function calls: `call f(...)`
- ✅ Message sends: `send ep.msg(...)` and `isend ep.msg(...)`, including interface endpoints
- ✅ Record initialisers: `Rec::{ field = value; ... }`
- ✅ Spawns: `spawn Proc(...)`

## Completion

- ✅ Anvil and Pact keywords, with documentation and snippets
- ✅ Unicode session-type operators (`\sum` → `∑`)
- ✅ Document symbols
- ✅ Endpoints and messages after `send`/`recv`/`isend`/`irecv`, including interface endpoints
- ✅ Context-aware suggestions inherited from the Anvil Language Server (registers, functions, types, enum variants, timing annotations)

## Code Lenses

- ✅ Process types: each process's declared interfaces, or else the type inferred from its threads, above its definition, and next to it the data-sensitive type inferred from the process (registers as recursion parameters, `if` guards, payloads `ep.m(x)` / `ep.m<e>`) with what it tracks. Types are shown in mathematical notation (`μ`, `⨁`, `⋀`, `∥`, `+ᶠ`) whichever notation the source uses (requires `process_type` in the AST; the data-sensitive type requires its `data_sensitive` field)

## Inlay Hints

- ✅ Session state: the remaining session type after each statement that advances it, and at the start of each offer arm
- ⏳ Clock-cycle and lifetime indicators (requires timing events)

## Syntax Highlighting

- ✅ VS Code (TextMate grammar)
- ✅ Vim (syntax file)
