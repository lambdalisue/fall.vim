import type { GetAction } from "../../@fall/action.ts";
import { systemopen } from "jsr:@lambdalisue/systemopen@1.0.0";
import { is } from "jsr:@core/unknownutil@3.18.0";

const description = `
Open the cursor item or selected items with system default application.
`.trim();

const isPathDetail = is.ObjectOf({
  path: is.String,
});

export const getAction: GetAction = () => {
  return {
    description,

    async invoke({ cursorItem, selectedItems }, { signal }) {
      const items = selectedItems.length > 0
        ? selectedItems
        : cursorItem
        ? [cursorItem]
        : [];
      for (const item of items) {
        if (!isPathDetail(item.detail)) {
          continue;
        }
        try {
          await systemopen(item.detail.path);
          signal?.throwIfAborted();
        } catch (err) {
          const m = err.message ?? err;
          console.warn(`[fall] Failed to open ${item.detail.path}: ${m}`);
        }
      }
      return false;
    },
  };
};
