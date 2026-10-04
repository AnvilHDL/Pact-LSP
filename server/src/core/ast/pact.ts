/**
 * Helpers for Pact-specific AST structure (schema v0.2.0 extensions).
 */

import { AnvilAst, AnvilAstNode } from './AnvilAst';
import { AnvilSessionState, AnvilSessionStateSchema } from './schema';

/**
 * Endpoint definitions visible in a process: its arguments and, for a process
 * typed by interfaces (`proc p(iface, ...)`), the parameters of those interfaces.
 */
export function processEndpointNodes(
  ast: AnvilAst,
  procNode: AnvilAstNode,
): AnvilAstNode[] {
  const childrenOf = (node: AnvilAstNode, key: string) =>
    node.unsafeTraverse(key).children as unknown[] as AnvilAstNode[];

  const interfaceParams = childrenOf(procNode, 'interfaces').flatMap((ref) =>
    ref.definitions
      .map((def) => ast.node(def))
      .filter((n): n is AnvilAstNode => n?.kind === 'interface_def')
      .flatMap((iface) => childrenOf(iface, 'params')),
  );
  return [...childrenOf(procNode, 'args'), ...interfaceParams];
}

/**
 * Definitions referenced by a message operation (`send`, `recv`, their `try`
 * forms, and `isend`/`irecv`). The Pact compiler attaches them to the message
 * specifier rather than the operation itself.
 */
export function messageOperationDefinitions(node: AnvilAstNode) {
  const msgSpec = node.unsafeTraverse('send_pack', 'msg_spec').resolve()
    ? node.unsafeTraverse('send_pack', 'msg_spec')
    : node.unsafeTraverse('recv_pack', 'msg_spec');
  return [...node.definitions, ...msgSpec.definitions];
}

/**
 * The session state of the innermost expression enclosing `node` (including
 * itself) that has one, with that expression's node.
 */
export function enclosingSessionState(
  node: AnvilAstNode,
): { node: AnvilAstNode; state: AnvilSessionState } | null {
  let current: AnvilAstNode = node;
  while (true) {
    const state = current
      .unsafeTraverse('session')
      .resolveAs(AnvilSessionStateSchema);
    if (state) {
      return { node: current, state };
    }
    if (current.isRoot()) {
      return null;
    }
    const currentNode: AnvilAstNode = current;
    current = currentNode.up() as AnvilAstNode;
  }
}

/** A remaining session type for display; `null` means the session is complete. */
export function formatSessionType(sessionType: string | null): string {
  return sessionType ?? 'done';
}
