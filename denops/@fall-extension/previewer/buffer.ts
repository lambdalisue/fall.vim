import type { GetPreviewer } from "../../@fall/previewer.ts";
import { batch } from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import { assert, is, maybe } from "jsr:@core/unknownutil@3.18.0";

const isOptions = is.StrictOf(is.PartialOf(is.ObjectOf({
  bufnameAttribute: is.String,
  lineAttribute: is.String,
  columnAttribute: is.String,
})));

export const getPreviewer: GetPreviewer = (denops, options) => {
  assert(options, isOptions);
  const bufnameAttribute = options.bufnameAttribute ?? "bufname";
  const lineAttribute = options.lineAttribute ?? "line";
  const columnAttribute = options.columnAttribute ?? "column";
  return {
    async preview({ item, bufnr, winid }, { signal }) {
      const bufname = maybe(item.detail[bufnameAttribute], is.String);
      if (!bufname) {
        // Try next previewer
        return true;
      }

      const line = maybe(item.detail[lineAttribute], is.Number) ?? 1;
      const column = maybe(item.detail[columnAttribute], is.Number) ?? 1;
      const content = await fn.getbufline(denops, bufname, 1, "$");
      signal?.throwIfAborted();

      await buffer.replace(denops, bufnr, content);
      signal?.throwIfAborted();

      await batch(denops, async (denops) => {
        await fn.win_execute(
          denops,
          winid,
          `silent! 0file`,
        );
        await fn.win_execute(
          denops,
          winid,
          `silent! syntax clear`,
        );
        await fn.win_execute(
          denops,
          winid,
          `silent! file fall://preview/${name}`,
        );
        await fn.win_execute(
          denops,
          winid,
          `silent! normal! ${line}G${column}|`,
        );
      });
    },
  };
};
