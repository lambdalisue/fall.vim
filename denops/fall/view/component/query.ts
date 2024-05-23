import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";

import { Spinner } from "../util/spinner.ts";
import { getByteLength } from "../../util/text.ts";

export type Context = {
  cmdline: string;
  cmdpos: number;
  collecting: boolean | "failed";
  processing: boolean | "failed";
  counter: {
    processed: number;
    collected: number;
    truncated: boolean;
  };
};

export type Params = Readonly<{
  winwidth: number;
  spinner?: readonly string[];
  headSymbol?: string;
  failSymbol?: string;
}>;

/**
 * Query component that shows user's input and status of item collector/processor
 */
export class QueryComponent implements Disposable {
  #bufnr: number;
  #winwidth: number;
  #spinner: Spinner;
  #headSymbol: string;
  #failSymbol: string;

  constructor(bufnr: number, _winid: number, params: Params) {
    this.#bufnr = bufnr;
    this.#winwidth = params.winwidth;
    this.#spinner = new Spinner(params.spinner);
    this.#headSymbol = params.headSymbol ?? HEAD_SYMBOL;
    this.#failSymbol = params.failSymbol ?? FAIL_SYMBOL;
  }

  async render(
    denops: Denops,
    { cmdline, cmdpos, collecting, processing, counter }: Context,
    { signal }: { signal: AbortSignal },
  ): Promise<void> {
    try {
      const spinner = this.#spinner.next();
      const headSymbol = !processing
        ? this.#headSymbol
        : processing === "failed"
        ? this.#failSymbol
        : spinner;
      const tailSymbol = !collecting
        ? ""
        : collecting === "failed"
        ? this.#failSymbol
        : spinner;
      const collected = counter.truncated
        ? `${counter.collected}+`
        : `${counter.collected}`;

      const prefix = `${headSymbol} `;
      const suffix = ` ${counter.processed}/${collected} ${tailSymbol}`;
      const spacer = " ".repeat(
        Math.max(
          0,
          this.#winwidth - Array.from(prefix + cmdline + suffix).length,
        ),
      );
      const prefixByteLength = getByteLength(prefix);
      const middleByteLength = getByteLength(cmdline + spacer);
      const suffixByteLength = getByteLength(suffix);

      await buffer.replace(denops, this.#bufnr, [
        prefix + cmdline + spacer + suffix,
      ]);
      signal.throwIfAborted();

      await buffer.decorate(denops, this.#bufnr, [
        {
          line: 1,
          column: 1,
          length: prefixByteLength,
          highlight: "FallQueryHeader",
        },
        {
          line: 1,
          column: Math.max(1, prefixByteLength + cmdpos),
          length: 1,
          highlight: "FallQueryCursor",
        },
        {
          line: 1,
          column: 1 + prefixByteLength + middleByteLength,
          length: suffixByteLength,
          highlight: "FallQueryCounter",
        },
      ]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const m = err.message ?? err;
      console.warn(`[fall] Failed to render the query component: ${m}`);
    }
  }

  [Symbol.dispose]() {
    this.#spinner[Symbol.dispose]();
  }
}

const HEAD_SYMBOL = ">";
const FAIL_SYMBOL = "☓";
