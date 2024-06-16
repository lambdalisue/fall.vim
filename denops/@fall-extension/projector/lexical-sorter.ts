import type { GetProjector } from "jsr:@lambdalisue/vim-fall@0.6.0/projector";
import { assert, is } from "jsr:@core/unknownutil@3.18.0";

import { retrieve } from "../util.ts";

const isOptions = is.StrictOf(is.PartialOf(is.ObjectOf({
  attrs: is.ArrayOf(is.String),
  reverse: is.Boolean,
})));

export const getProjector: GetProjector = (_denops, options) => {
  assert(options, isOptions);
  const attrs = options.attrs ?? ["value"];
  const alpha = options.reverse ? -1 : 1;
  return {
    project({ items }, { signal }) {
      return items.toSorted((a, b) => {
        signal?.throwIfAborted();
        const va = retrieve(a, attrs, is.String) ?? "";
        const vb = retrieve(b, attrs, is.String) ?? "";
        return va.localeCompare(vb) * alpha;
      });
    },
  };
};
