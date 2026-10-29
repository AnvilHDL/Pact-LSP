import { CodeLens } from 'vscode-languageserver';
import { AnvilDocument } from '../core/AnvilDocument';
import { AnvilAstNode } from '../core/ast/AnvilAst';
import { AnvilProcessTypeSchema } from '../core/ast/schema';
import { sessionTypeMath } from '../core/ast/sessionTypeMath';

/** Longest type shown in a lens; a longer one is left to the hover. */
const MAX_TYPE = 100;

export class AnvilCodeLensGenerator {
  private constructor() {}

  /**
   * A lens above each process showing its type: the declared interfaces, or
   * else the type inferred from its threads. A second lens shows the
   * data-sensitive type inferred from the process, when it tracks any data.
   * A type too long for one line is named only; hovering the process shows
   * it in full, over several lines.
   */
  public static generateCodeLenses(anvilDocument: AnvilDocument): CodeLens[] {
    const ast = anvilDocument.anvilAst;
    const root = ast?.root(anvilDocument.filepath);
    if (!root) return [];

    const procs = root.unsafeTraverse('procs')
      .children as unknown[] as AnvilAstNode[];
    const lenses: CodeLens[] = [];
    for (const proc of procs) {
      const ptype = proc
        .unsafeTraverse('process_type')
        .resolveAs(AnvilProcessTypeSchema);
      const span = proc.span;
      if (!ptype || !span) continue;
      const position = anvilDocument.getLspPosOfAnvilPos(span.start);
      if (!position) continue;

      const label =
        ptype.source === 'declared'
          ? ptype.interfaces.join(' ∥ ')
          : 'inferred type';
      lenses.push(
        this.lens(position, label, ptype.type as Record<string, unknown>),
      );

      const ds = ptype.data_sensitive;
      if (ds) {
        lenses.push(
          this.lens(
            position,
            `data-sensitive, tracking ${ds.tracks.join(', ')}`,
            ds.type as Record<string, unknown>,
          ),
        );
      }
    }
    return lenses;
  }

  private static lens(
    position: CodeLens['range']['start'],
    label: string,
    type: Record<string, unknown>,
  ): CodeLens {
    const text = sessionTypeMath(type);
    const title =
      text.length <= MAX_TYPE
        ? `${label} : ${text}`
        : `${label} (hover for type)`;
    return {
      range: { start: position, end: position },
      command: { title, command: '' },
    };
  }
}
