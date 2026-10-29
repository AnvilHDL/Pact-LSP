# Changelog

## Unreleased

- A process type too long for one line is named in its lens; hovering the process shows its type and data-sensitive type over several lines.
- Show the data-sensitive type inferred from each process next to its type, with the registers and payloads it tracks; render payload actions `ep.m(x)` and `ep.m<e>`.

## 0.2.0

- Show each process's type above its definition: its declared interfaces, or the type inferred from its threads, in mathematical notation. Controlled by `pact.showProcessTypes`.
- Highlight process pool members (`i : proc p(...)`) and `spawn pool.member`.

## 0.1.0

Initial release.
