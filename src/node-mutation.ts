import type { Action, InsertOptions, ReplaceOptions, ReplaceWithOptions, ProcessResult } from "./types";
import Adapter from "./adapter";
import TypescriptAdapter from "./typescript-adapter";
import { AppendAction, DeleteAction, InsertAction, PrependAction, RemoveAction, ReplaceWithAction, ReplaceAction } from "./action";
import { ConflictActionError } from "./error";

export enum STRATEGY {
  KEEP_RUNNING = 1,
  THROW_ERROR,
}

class NodeMutation<T> {
  private static adapter?: Adapter<any>;
  private static strategy?: STRATEGY = STRATEGY.THROW_ERROR;
  public actions: Action[] = [];

  /**
   * Configure NodeMutation
   * @static
   * @param options {Object}
   * @param options.adapter {Adapter} - adapter, default is TypescriptAdapter
   * @param options.strategy {STRATEGY} - strategy, default is STRATEGY.THROW_ERROR
   */
  static configure(options: { adapter?: Adapter<any>, strategy?: STRATEGY }) {
    if (options.adapter) {
      this.adapter = options.adapter;
    }
    if (options.strategy) {
      this.strategy = options.strategy;
    }
  }

  static getAdapter(): Adapter<any> {
    if (!this.adapter) {
      this.adapter = new TypescriptAdapter();
    }
    return this.adapter!;
  }

  /**
   * Initialize a NodeMutation
   * @param source {string} - file source.
   */
  constructor(private source: string) {}

  /**
   * Append code to the ast node.
   * @param node {T} - ast node
   * @param code {string} - new code to append
   * @example
   * source code of the ast node is
   * ```
   * class FooBar {
   *   foo() {}
   * }
   * ```
   * then we call
   * ```
   * mutation.append(node, "bar() {}");
   * ```
   * the source code will be rewritten to
   * ```
   * class FooBar {
   *   foo() {}
   *   bar() {}
   * }
   * ```
   */
  append(node: T, code: string) {
    this.actions.push(new AppendAction<T>(node, code).process());
  }

  /**
   * Delete source code of the child ast node
   * @param node {T} - current ast node
   * @param selectors {string|string[]} - selectors to find chid ast nodes
   * @example
   * source code of the ast node is
   * ```
   * this.foo.bind(this)
   * ```
   * then we call
   * ```
   * mutation.delete(["expression.expression.dot", "expression.expression.name", "expression.arguments"])
   * ```
   * the source code will be rewritten to
   * ```
   * this.foo
   * ```
   */
  delete(node: T, selectors: string | string[]) {
    this.actions.push(new DeleteAction<T>(node, selectors).process());
  }

  /**
   * Insert code to the ast node.
   * @param node {T} - ast node
   * @param code {string} - new code to insert
   * @param options {Object}
   * @params options.at {string} - position to insert, "beginning" or "end", "end" is by default
   * @params options.to {string} - selector to find the child ast node
   * @example
   * source code of the ast node is
   * ```
   * this.foo
   * ```
   * then we call
   * ```
   * mutation.insert(node, "::", { at: "beginning" });
   * ```
   * the source code will be rewritten to
   * ```
   * ::this.foo
   * ```
   * if we call
   * ```
   * mutation.insert(node, ".bar", { to: "expression.expression" })
   * }
   * ```
   * the source code will be rewritten to
   * ```
   * this.foo.bar
   * ```
   */
  insert(node: T, code: string, options: InsertOptions) {
    this.actions.push(new InsertAction<T>(node, code, options).process());
  }

  /**
   * Prepend code to the ast node.
   * @param node {T} - ast node
   * @param code {string} - new code to prepend
   * @example
   * source code of the ast node is
   * ```
   * class FooBar {
   *   foo() {}
   * }
   * ```
   * then we call
   * ```
   * mutation.prepend(node, "bar() {}");
   * ```
   * the source code will be rewritten to
   * ```
   * class FooBar {
   *   bar() {}
   *   foo() {}
   * }
   * ```
   */
  prepend(node: T, code: string) {
    this.actions.push(new PrependAction<T>(node, code).process());
  }

  /**
   * Remove source code of the ast node
   * @param node {T} - ast node
   * @example
   * source code of the ast node is
   * ```
   * this.foo.bind(this)
   * ```
   * then we call
   * ```
   * mutation.remove()
   * ```
   * the source code will be completely removed
   */
  remove(node: T) {
    this.actions.push(new RemoveAction<T>(node).process());
  }

  /**
   * Replace child node of the ast node with new code
   * @param node {T} - current ast node
   * @param selectors {string|string[]} - selectors to find chid ast nodes
   * @param options {Object}
   * @params options.with {string} - new code to replace
   * @example
   * source code of the ast node is
   * ```
   * class FooBar {}
   * ```
   * then we call
   * ```
   * mutation.replace(node, "name", { with: "Synvert" });
   * ```
   * the source code will be rewritten to
   * ```
   * class Synvert {}
   * ```
   */
  replace(node: T, selectors: string | string[], options: ReplaceOptions) {
    this.actions.push(new ReplaceAction<T>(node, selectors, options).process());
  }

  /**
   * Replace the ast node with new code
   * @param node {T} - ast node
   * @params code {string} - new code to replace
   * @example
   * source code of the ast node is
   * ```
   * !!foobar
   * ```
   * then we call
   * ```
   * mutation.replaceWith(node, "Boolean({{expression.operand.operand}})");
   * ```
   * the source code will be rewritten to
   * ```
   * Boolean(foobar)
   * ```
   */
  replaceWith(node: T, code: string, options: ReplaceWithOptions = { autoIndent: true }) {
    this.actions.push(new ReplaceWithAction<T>(node, code, options).process());
  }

  /**
   * @typedef {Object} ProcessResult
   * @property {number} conflict - if there's any action range conflicted
   */

  /**
   * Read the source code from file path,
   * rewrite the source code based on all actions,
   * then write the new source code back to the file.
   *
   * If there's an action range conflict,
   * it will raise a ConflictActionError if strategy is set to THROW_ERROR,
   * it will process all non conflicted actions and return `{ conflict: true }`
   * if strategy is set to KEEP_RUNNING.
   * @returns {ProcessResult} if actions are conflicted
   */
  process(): ProcessResult {
    if (this.actions.length == 0) {
      return { affected: false, conflicted: false };
    }
    let conflictActions = [];
    this.actions.sort(this.compareActions);
    conflictActions = this.getConflictActions();
    if (conflictActions.length > 0  && NodeMutation.strategy === STRATEGY.THROW_ERROR) {
      throw new ConflictActionError();
    }
    let newSource = this.source;
    this.actions.reverse().forEach((action) => {
      newSource =
        newSource.slice(0, action.start) +
        action.newCode +
        newSource.slice(action.end);
    });
    this.actions = [];

    return {
      affected: true,
      conflicted: conflictActions.length !== 0,
      newSource
    };
  }

  /**
   * Action sort function.
   * @private
   * @param {Action} actionA
   * @param {Action} actionB
   * @returns {number} returns 1 if actionA goes before actionB, -1 if actionA goes after actionB
   */
   private compareActions(actionA: Action, actionB: Action): 0 | 1 | -1 {
    if (actionA.start > actionB.start) return 1;
    if (actionA.start < actionB.start) return -1;
    if (actionA.end > actionB.end) return 1;
    if (actionA.end < actionB.end) return -1;
    return 0;
  }

  /**
   * Get conflict actions.
   * @private
   * @returns {Action[]} conflict actions
   */
  private getConflictActions(): Action[] {
    let i = this.actions.length - 1;
    let j = i - 1;
    const conflictActions: Action[] = [];
    if (i < 0) return [];

    let beginPos = this.actions[i].start;
    while (j > -1) {
      if (beginPos < this.actions[j].end) {
        conflictActions.push(this.actions.splice(j, 1)[0]);
      } else {
        i = j;
        beginPos = this.actions[i].start;
      }
      j--;
    }
    return conflictActions;
  }
}

export default NodeMutation;