import { CodeLens } from 'vscode-languageserver';
import { AnvilDocument } from '../core/AnvilDocument';
import { AnvilAstNode } from '../core/ast/AnvilAst';
import { AnvilProcessTypeSchema } from '../core/ast/schema';
import { sessionTypeMath } from '../core/ast/sessionTypeMath';

/** Longest lens title; longer types are cut at a separator and end in an ellipsis. */
const MAX_TITLE = 200;

export class AnvilCodeLensGenerator {
  private constructor() {}

  /**
   * A lens above each process showing its type: the declared interfaces, or
   * else the type inferred from its threads. A second lens shows the
   * data-sensitive type inferred from the process, when it tracks any data.
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
        ptype.source === 'declared' ? ptype.interfaces.join(' ∥ ') : 'inferred';
      const title = this.shorten(
        `${label} : ${sessionTypeMath(ptype.type as Record<string, unknown>)}`,
      );
      lenses.push({
        range: { start: position, end: position },
        command: { title, command: '' },
      });

      const ds = ptype.data_sensitive;
      if (ds) {
        lenses.push({
          range: { start: position, end: position },
          command: {
            title: this.shorten(
              `data-sensitive (tracks ${ds.tracks.join(', ')}) : ${sessionTypeMath(ds.type as Record<string, unknown>)}`,
            ),
            command: '',
          },
        });
      }
    }
    return lenses;
  }

  private static shorten(title: string): string {
    if (title.length <= MAX_TITLE) return title;
    const cut = title.lastIndexOf(' ', MAX_TITLE - 1);
    return `${title.slice(0, cut > 0 ? cut : MAX_TITLE - 1)} …`;
  }
}
