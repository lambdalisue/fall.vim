import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as opt from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import { g } from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import {
  batch,
  collect,
} from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";

import type {
  Item,
  Previewer,
  Projector,
  Renderer,
  SourceItem,
  Transformer,
} from "../extension/type.ts";
import { isDefined } from "../util/collection.ts";
import { subscribe } from "../util/event.ts";
import { startAsyncScheduler } from "../util/async_scheduler.ts";
import { buildLayout, Layout, LayoutParams } from "./layout/picker_layout.ts";
import { QueryComponent } from "./component/query.ts";
import { SelectorComponent } from "./component/selector.ts";
import { PreviewComponent } from "./component/preview.ts";
import { observeInput, startInput } from "./util/input.ts";
import { ItemCollector } from "./util/item_collector.ts";
import { ItemProcessor } from "./util/item_processor.ts";

export type PickerContext = {
  readonly query: string;
  readonly index: number;
  readonly selected: Set<unknown>;
};

export type PickerOptions = Readonly<{
  title?: string;
  selectable?: boolean;
  restoreContext?: PickerContext;
  layout?: Partial<LayoutParams>;
  redraw?: Readonly<{
    interval?: number;
  }>;
  query?: Readonly<{
    spinner?: readonly string[];
    headSymbol?: string;
    failSymbol?: string;
  }>;
  itemCollector?: Readonly<{
    threshold?: number;
  }>;
}>;

export class Picker implements AsyncDisposable {
  readonly #renderers: readonly Renderer[];
  readonly #previewers: readonly Previewer[];
  readonly #options: PickerOptions;
  readonly #itemCollector: ItemCollector;
  readonly #itemProcessor: ItemProcessor;
  readonly #disposable: AsyncDisposableStack;

  #layout?: Layout;
  #cmdpos = 0;
  #query = "";
  #index = 0;
  #selected = new Set<unknown>();

  private constructor(
    itemCollector: ItemCollector,
    itemProcessor: ItemProcessor,
    renderers: readonly Renderer[],
    previewers: readonly Previewer[],
    options: PickerOptions,
    stack: AsyncDisposableStack,
  ) {
    this.#renderers = renderers;
    this.#previewers = previewers;
    this.#options = options;
    this.#itemCollector = itemCollector;
    this.#itemProcessor = itemProcessor;
    this.#disposable = stack;
  }

  static async fromStream(
    stream: ReadableStream<SourceItem>,
    transformers: readonly Transformer[],
    projectors: readonly Projector[],
    renderers: readonly Renderer[],
    previewers: readonly Previewer[],
    options: PickerOptions,
  ): Promise<Picker> {
    await using stack = new AsyncDisposableStack();
    const itemCollector = stack.use(
      new ItemCollector(stream, {
        threshold: options.itemCollector?.threshold,
      }),
    );
    const itemProcessor = stack.use(
      new ItemProcessor(transformers, projectors),
    );
    const picker = new Picker(
      itemCollector,
      itemProcessor,
      renderers,
      previewers,
      options,
      stack.move(),
    );
    if (options.restoreContext) {
      picker.#query = options.restoreContext.query;
      picker.#index = options.restoreContext.index;
      picker.#selected = options.restoreContext.selected;
    }
    return picker;
  }

  get context(): PickerContext {
    return {
      query: this.#query,
      index: this.#index,
      selected: this.#selected,
    };
  }

  get collectedItems(): readonly Item[] {
    return this.#itemCollector.items;
  }

  get processedItems(): readonly Item[] {
    return this.#itemProcessor.items;
  }

  get selectedItems(): readonly Item[] {
    const m = new Map(this.processedItems.map((v) => [v.id, v]));
    return [...this.#selected].map((v) => m.get(v)).filter(isDefined);
  }

  get cursorItem(): Item | undefined {
    return this.processedItems.at(this.#index);
  }

  #correctIndex(index: number): number {
    const max = this.processedItems.length - 1;
    return Math.max(0, Math.min(max, index));
  }

  async open(denops: Denops): Promise<AsyncDisposable> {
    if (this.#layout) {
      throw new Error("The picker is already opened");
    }
    this.#layout = await buildLayout(denops, {
      title: this.#options.title,
      width: this.#options.layout?.width,
      widthRatio: this.#options.layout?.widthRatio ?? WIDTH_RATION,
      widthMin: this.#options.layout?.widthMin ?? WIDTH_MIN,
      widthMax: this.#options.layout?.widthMax ?? WIDTH_MAX,
      height: this.#options.layout?.height,
      heightRatio: this.#options.layout?.heightRatio ?? HEIGHT_RATION,
      heightMin: this.#options.layout?.heightMin ?? HEIGHT_MIN,
      heightMax: this.#options.layout?.heightMax ?? HEIGHT_MAX,
      previewRatio: this.#options.layout?.previewRatio ?? PREVIEW_RATION,
      border: this.#options.layout?.border,
      divider: this.#options.layout?.divider,
      zindex: this.#options.layout?.zindex ?? 50,
    });
    this.#disposable.use(this.#layout);
    return {
      [Symbol.asyncDispose]: async () => {
        if (this.#layout) {
          await this.#layout[Symbol.asyncDispose]();
          this.#layout = undefined;
        }
      },
    };
  }

  async start(
    denops: Denops,
    options: { signal: AbortSignal },
  ): Promise<boolean> {
    if (!this.#layout) {
      throw new Error("The picker is not opnend");
    }
    const layout = this.#layout;

    await using stack = new AsyncDisposableStack();
    const controller = new AbortController();
    const signal = AbortSignal.any([options.signal, controller.signal]);
    stack.defer(() => {
      try {
        controller.abort();
      } catch {
        // Fail silently
      }
    });

    // Set internal variables
    await batch(denops, async (denops) => {
      await g.set(
        denops,
        "_fall_layout_query_winid",
        layout.query.winid,
      );
      await g.set(
        denops,
        "_fall_layout_selector_winid",
        layout.selector.winid,
      );
      await g.set(
        denops,
        "_fall_layout_preview_winid",
        layout.preview.winid,
      );
    });

    // Collect informations
    const [scrolloff, queryWinwidth, selectorWinwidth, selectorWinheight] =
      await collect(
        denops,
        (denops) => [
          opt.scrolloff.get(denops),
          fn.winwidth(denops, layout.query.winid),
          fn.winwidth(denops, layout.selector.winid),
          fn.winheight(denops, layout.selector.winid),
        ],
      );

    // Bind components to the layout
    const query = stack.use(
      new QueryComponent(
        layout.query.bufnr,
        layout.query.winid,
        {
          winwidth: queryWinwidth,
          spinner: this.#options.query?.spinner,
          headSymbol: this.#options.query?.headSymbol,
          failSymbol: this.#options.query?.failSymbol,
        },
      ),
    );
    const selector = stack.use(
      new SelectorComponent(
        layout.selector.bufnr,
        layout.selector.winid,
        {
          scrolloff,
          winwidth: selectorWinwidth,
          winheight: selectorWinheight,
          renderers: this.#renderers,
        },
      ),
    );
    const preview = stack.use(
      new PreviewComponent(
        layout.preview.bufnr,
        layout.preview.winid,
        {
          previewers: this.#previewers,
        },
      ),
    );

    let renderQuery = true;
    let renderSelector = true;
    let renderPreview = true;
    const emitQueryUpdate = () => {
      renderQuery = true;
    };
    const emitSelectorUpdate = () => {
      renderSelector = true;
    };
    const emitPreviewUpdate = () => {
      renderPreview = true;
    };
    const emitItemProcessor = () => {
      this.#itemProcessor.start(
        this.collectedItems,
        { query: this.#query },
        { signal },
      );
    };

    stack.use(subscribe("item-collector-changed", () => {
      emitQueryUpdate();
      emitItemProcessor();
    }));
    stack.use(subscribe("item-collector-succeeded", () => {
      emitQueryUpdate();
      emitItemProcessor();
    }));
    stack.use(subscribe("item-collector-failed", () => {
      emitQueryUpdate();
    }));
    stack.use(subscribe("item-processor-succeeded", () => {
      this.#index = this.#correctIndex(this.#index);
      emitQueryUpdate();
      emitSelectorUpdate();
      emitPreviewUpdate();
    }));
    stack.use(subscribe("item-processor-failed", () => {
      emitQueryUpdate();
    }));
    stack.use(subscribe("cmdline-changed", (cmdline) => {
      if (this.#query === cmdline) {
        return;
      }
      this.#query = cmdline;
      emitQueryUpdate();
      emitItemProcessor();
    }));
    stack.use(subscribe("cmdpos-changed", (cmdpos) => {
      if (this.#cmdpos === cmdpos) {
        return;
      }
      this.#cmdpos = cmdpos;
      emitQueryUpdate();
    }));
    stack.use(subscribe("selector-cursor-move", (offset) => {
      const newIndex = this.#correctIndex(this.#index + offset);
      if (this.#index === newIndex) {
        return;
      }
      this.#index = newIndex;
      emitSelectorUpdate();
      emitPreviewUpdate();
    }));
    stack.use(subscribe("selector-cursor-move-at", (line) => {
      const newIndex = this.#correctIndex(
        line === "$" ? this.processedItems.length - 1 : line - 1,
      );
      if (this.#index === newIndex) {
        return;
      }
      this.#index = newIndex;
      emitSelectorUpdate();
      emitPreviewUpdate();
    }));
    stack.use(subscribe("preview-cursor-move", (offset) => {
      preview.moveCursor(denops, offset, { signal });
      emitPreviewUpdate();
    }));
    stack.use(subscribe("preview-cursor-move-at", (line) => {
      preview.moveCursorAt(denops, line, { signal });
      emitPreviewUpdate();
    }));
    if (this.#options.selectable) {
      stack.use(subscribe("selector-select", () => {
        const item = this.cursorItem;
        if (!item) return;
        if (this.#selected.has(item.id)) {
          this.#selected.delete(item.id);
        } else {
          this.#selected.add(item.id);
        }
        emitSelectorUpdate();
      }));
      stack.use(subscribe("selector-select-all", () => {
        if (this.#selected.size === this.processedItems.length) {
          this.#selected.clear();
        } else {
          this.#selected = new Set(
            this.processedItems.map((v) => v.id),
          );
        }
        emitSelectorUpdate();
      }));
    }

    startAsyncScheduler(
      async () => {
        const collecting = this.#itemCollector.collecting;
        const processing = this.#itemProcessor.processing;
        renderQuery ||= collecting || processing;

        if (!renderQuery && !renderSelector && !renderPreview) {
          // No need to render & redraw
          return;
        }

        if (renderQuery) {
          renderQuery = false;
          await query.render(
            denops,
            {
              cmdline: this.#query,
              cmdpos: this.#cmdpos,
              collecting,
              processing,
              counter: {
                processed: this.processedItems.length,
                collected: this.collectedItems.length,
                truncated: this.#itemCollector.truncated,
              },
            },
            { signal },
          );
        }

        if (renderSelector) {
          renderSelector = false;
          await selector.render(
            denops,
            {
              items: this.processedItems,
              index: this.#index,
              selected: this.#selected,
            },
            { signal },
          );
        }

        if (renderPreview) {
          renderPreview = false;
          await preview.render(
            denops,
            this.cursorItem,
            { signal },
          );
        }

        await denops.cmd("redraw");
      },
      this.#options.redraw?.interval ?? REDRAW_INTERVAL,
      { signal },
    );

    // Observe Vim's prompt
    stack.use(observeInput(denops, { signal }));

    // Start collecting
    this.#itemCollector.start({ signal });

    // Wait for user input
    return await startInput(
      denops,
      { text: this.#query },
      { signal },
    );
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#disposable.disposeAsync();
  }
}

const WIDTH_RATION = 0.9;
const WIDTH_MIN = 80;
const WIDTH_MAX = 800;
const HEIGHT_RATION = 0.9;
const HEIGHT_MIN = 5;
const HEIGHT_MAX = 300;
const PREVIEW_RATION = 0.65;
const REDRAW_INTERVAL = 0;
