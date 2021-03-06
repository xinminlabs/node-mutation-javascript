import { BaseAction } from "../action";
import { getAdapter, DEFAULT_INDENT } from "../helpers";

/**
 * AppendAction to append code to the bottom of node body.
 * @extends BaseAction
 */
export class AppendAction<T> extends BaseAction<T> {
  /**
   * Calculate the begin and end positions.
   * @protected
   */
  calculatePositions() {
    this.start = getAdapter<T>().getEnd(this.node) - getAdapter<T>().getIndent(this.node) - "}".length;
    this.end = this.start;
  }

  /**
   * The rewritten source code.
   * @returns {string} rewritten code.
   */
  get newCode() {
    const source = this.rewrittenSource();
    const indent = " ".repeat(getAdapter<T>().getIndent(this.node) + DEFAULT_INDENT);
    if (source.split("\n").length > 1) {
      return (
        source
          .split("\n")
          .map((line) => indent + line)
          .join("\n") + "\n"
      );
    } else {
      return indent + source + "\n";
    }
  }
}
