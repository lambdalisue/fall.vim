import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import {
  batch,
  collect,
} from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as opt from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import * as popup from "https://deno.land/x/denops_std@v6.4.0/popup/mod.ts";
import { is, type Predicate } from "jsr:@core/unknownutil@3.18.0";

import {
  type Border,
  BORDER_B,
  BORDER_BL,
  BORDER_BR,
  BORDER_L,
  BORDER_R,
  BORDER_T,
  BORDER_TL,
  BORDER_TR,
  getBorder,
  getDefaultBorder,
  isBorder,
} from "./border.ts";
import {
  type Divider,
  DIVIDER_H,
  DIVIDER_L,
  DIVIDER_R,
  getDefaultDivider,
  getDivider,
  isDivider,
} from "./divider.ts";
import { calcProperSize } from "./util.ts";

export type LayoutParams = {
  title?: string;
  width?: number;
  widthRatio: number;
  widthMin: number;
  widthMax: number;
  height?: number;
  heightRatio: number;
  heightMin: number;
  heightMax: number;
  previewRatio: number;
  border?: "none" | "ascii" | "single" | "double" | "rounded" | Border;
  divider?: "none" | "ascii" | "single" | "double" | "dashed" | Divider;
  zindex?: number;
};

export const isLayoutParams = is.ObjectOf({
  title: is.OptionalOf(is.String),
  width: is.OptionalOf(is.Number),
  widthRatio: is.Number,
  widthMin: is.Number,
  widthMax: is.Number,
  height: is.OptionalOf(is.Number),
  heightRatio: is.Number,
  heightMin: is.Number,
  heightMax: is.Number,
  previewRatio: is.Number,
  border: is.OptionalOf(isBorder),
  divider: is.OptionalOf(isDivider),
  zindex: is.OptionalOf(is.Number),
}) satisfies Predicate<LayoutParams>;

export interface Layout extends AsyncDisposable {
  query: popup.PopupWindow;
  select: popup.PopupWindow;
  preview: popup.PopupWindow;
}

/**
 * Query head / Preview right layout
 *
 * ```
 *                 width
 * ┌─────────────────────────────────────┐
 *
 * ╭──────────────────────╮╭─────────────╮  ┐
 * │        Query         ││             │  │
 * │----------------------││             │  │
 * │                      ││   Preview   │  │height
 * │        Select        ││             │  │
 * │                      ││             │  │
 * ╰──────────────────────╯╰─────────────╯  ┘
 *
 * └──────────────────────┘└─────────────┘
 *        mainWidth         previewWidth
 * ```
 */
export async function buildLayout(
  denops: Denops,
  params: LayoutParams,
): Promise<Layout> {
  await using stack = new AsyncDisposableStack();
  stack.defer(() => denops.redraw());

  const [screenWidth, screenHeight] = await collect(
    denops,
    (denops) => [
      opt.columns.get(denops),
      opt.lines.get(denops),
    ],
  );
  const width = params.width ??
    calcProperSize(
      screenWidth,
      params.widthRatio,
      params.widthMin,
      params.widthMax,
    );
  const height = params.height ??
    calcProperSize(
      screenHeight,
      params.heightRatio,
      params.heightMin,
      params.heightMax,
    );
  const x = Math.floor((screenWidth - width) / 2);
  const y = Math.floor((screenHeight - height) / 2);

  const previewWidth = calcProperSize(
    width,
    params.previewRatio,
    params.widthMin * params.previewRatio,
    params.widthMax * params.previewRatio,
  );
  const mainWidth = width - previewWidth;

  const border = params.border
    ? getBorder(params.border)
    : await getDefaultBorder(denops);
  const divider = params.divider
    ? getDivider(params.divider)
    : await getDefaultDivider(denops);

  const query = stack.use(
    await popup.open(denops, {
      title: params.title,
      relative: "editor",
      anchor: "NW",
      width: mainWidth - 2, // -2 for border
      height: 1,
      row: y,
      col: x,
      border: [
        border[BORDER_TL],
        border[BORDER_T],
        border[BORDER_TR],
        border[BORDER_R],
        divider[DIVIDER_R],
        divider[DIVIDER_H],
        divider[DIVIDER_L],
        border[BORDER_L],
      ],
      highlight: {
        normal: "FallNormal",
        border: "FallBorder",
      },
      zindex: params.zindex,
      noRedraw: true,
    }),
  );

  const select = stack.use(
    await popup.open(denops, {
      relative: "editor",
      anchor: "NW",
      width: mainWidth - 2, // -2 for border
      height: height - 1 - 3, // -1 for query, -3 for border
      row: y + 3, // +3 for query and border
      col: x,
      border: [
        "",
        "",
        "",
        border[BORDER_R],
        border[BORDER_BR],
        border[BORDER_B],
        border[BORDER_BL],
        border[BORDER_L],
      ],
      highlight: {
        normal: "FallNormal",
        border: "FallBorder",
      },
      zindex: params.zindex,
      noRedraw: true,
    }),
  );

  const preview = stack.use(
    await popup.open(denops, {
      relative: "editor",
      anchor: "NW",
      width: previewWidth - 2, // -2 for border
      height: height - 2, // -2 for border
      row: y,
      col: x + mainWidth,
      border: [
        border[BORDER_TL],
        border[BORDER_T],
        border[BORDER_TR],
        border[BORDER_R],
        border[BORDER_BR],
        border[BORDER_B],
        border[BORDER_BL],
        border[BORDER_L],
      ],
      highlight: {
        normal: "FallNormal",
        border: "FallBorder",
      },
      zindex: params.zindex,
      noRedraw: true,
    }),
  );

  // NOTE:
  // Using `setbufvar` on popup window doesn't work well on Vim.
  // That's why we use win_execute instead even for buffer-local settings.
  await batch(denops, async (denops) => {
    await fn.bufload(denops, query.bufnr);
    await fn.win_execute(
      denops,
      query.winid,
      "setlocal filetype=fall-query",
    );

    await fn.bufload(denops, select.bufnr);
    await fn.win_execute(
      denops,
      select.winid,
      "setlocal filetype=fall-select",
    );

    await fn.bufload(denops, preview.bufnr);
    await fn.win_execute(
      denops,
      preview.winid,
      "setlocal nowrap nofoldenable signcolumn=no",
    );

    await denops.redraw();
  });

  const successStack = stack.move();
  return {
    query,
    select,
    preview,
    [Symbol.asyncDispose]: () => successStack.disposeAsync(),
  };
}
