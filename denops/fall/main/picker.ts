import type { Denops, Entrypoint } from "jsr:@denops/std@^7.3.2";
import { ensurePromise } from "jsr:@core/asyncutil@^1.2.0/ensure-promise";
import { assert, ensure, is } from "jsr:@core/unknownutil@^4.3.0";
import type { DetailUnit } from "jsr:@vim-fall/core@^0.3.0/item";

import type { PickerParams } from "../custom.ts";
import {
  getActionPickerParams,
  getPickerParams,
  getSetting,
  listPickerNames,
  loadUserCustom,
} from "../custom.ts";
import { isOptions, isPickerParams, isStringArray } from "../util/predicate.ts";
import { action as buildActionSource } from "../extension/source/action.ts";
import { Picker } from "../picker.ts";
import type { SubmatchContext } from "./submatch.ts";
import { ExpectedError, withHandleError } from "../error.ts";

let zindex = 50;

export const main: Entrypoint = (denops) => {
  denops.dispatcher = {
    ...denops.dispatcher,
    "picker": (args, itemPickerParams, options) => {
      assert(args, isStringArray);
      assert(itemPickerParams, isPickerParams);
      assert(options, isOptions);
      return startPicker(denops, args, itemPickerParams, options);
    },
    "picker:command": withHandleError(denops, async (args) => {
      await loadUserCustom(denops);
      // Split the command arguments
      const [name, ...sourceArgs] = ensure(args, isStringArray);
      // Load user custom
      const itemPickerParams = getPickerParams(name);
      if (!itemPickerParams) {
        throw new ExpectedError(
          `No item picker "${name}" is found. Available item pickers are: ${
            listPickerNames().join(", ")
          }`,
        );
      }
      await startPicker(
        denops,
        sourceArgs,
        itemPickerParams,
        { signal: denops.interrupted },
      );
    }),
    "picker:command:complete": withHandleError(
      denops,
      async (arglead, cmdline, cursorpos) => {
        await loadUserCustom(denops);
        assert(arglead, is.String);
        assert(cmdline, is.String);
        assert(cursorpos, is.Number);
        return listPickerNames().filter((name) => name.startsWith(arglead));
      },
    ),
  };
};

async function startPicker(
  denops: Denops,
  args: string[],
  pickerParams: PickerParams<DetailUnit, string>,
  { signal }: { signal?: AbortSignal } = {},
): Promise<void | true> {
  await using stack = new AsyncDisposableStack();
  const setting = getSetting();
  const itemPicker = stack.use(
    new Picker({
      ...setting,
      ...pickerParams,
      zindex,
    }),
  );
  zindex += Picker.ZINDEX_ALLOCATION;
  stack.defer(() => {
    zindex -= Picker.ZINDEX_ALLOCATION;
  });
  const actionPicker = stack.use(
    new Picker({
      name: "@action",
      source: buildActionSource(pickerParams.actions),
      ...setting,
      ...getActionPickerParams(),
      zindex,
    }),
  );
  zindex += Picker.ZINDEX_ALLOCATION;
  stack.defer(() => {
    zindex -= Picker.ZINDEX_ALLOCATION;
  });

  stack.use(await itemPicker.open(denops, { signal }));
  while (true) {
    // Redraw the screen to clean up the closed action picker
    await denops.cmd("redraw");

    // Select items
    const resultItem = await itemPicker.start(
      denops,
      { args },
      { signal },
    );
    if (!resultItem) {
      // Cancelled
      return true;
    }

    // Select an action
    let actionName: string;
    if (resultItem.action === "@select") {
      // Open the action picker to select an action
      await using _guardActionPicker = await actionPicker.open(denops, {
        signal,
      });
      const resultAction = await actionPicker.start(
        denops,
        { args: [] },
        { signal },
      );
      if (!resultAction) {
        // Return to the item picker
        continue;
      }
      if (!resultAction.item) {
        // Cancelled
        return true;
      }
      actionName = resultAction.item.value;
    } else if (resultItem.action) {
      actionName = resultItem.action;
    } else {
      // Default action
      actionName = pickerParams.defaultAction;
    }

    // Execute the action
    const action = pickerParams.actions[actionName];
    if (!action) {
      throw new ExpectedError(
        `No action "${actionName}" is found. Available actions are: ${
          Object.keys(pickerParams.actions).join(
            ", ",
          )
        }`,
      );
    }
    const actionParams = {
      // Secret attribute for @vim-fall/std/builtin/action/submatch
      _submatch: {
        pickerParams,
      },
      ...resultItem,
    } as const satisfies SubmatchContext;
    if (await ensurePromise(action.invoke(denops, actionParams, { signal }))) {
      // Picker should not be closed
      continue;
    }
    // Successfully completed
    return;
  }
}
