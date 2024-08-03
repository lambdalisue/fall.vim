import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { subscribe } from "../util/event.ts";
import { ItemCollector } from "./item_collector.ts";

Deno.test("ItemCollector", async (t) => {
  const controller = new AbortController();
  const { signal } = controller;
  await t.step("collect items from empty stream", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    using _ = subscribe("item-collector-completed", () => resolve());
    await using collector = new ItemCollector({
      stream: ReadableStream.from([]),
    });
    collector.start({ signal });
    await promise;
    assertEquals(collector.items, []);
  });

  await t.step("collect items from stream", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    using _ = subscribe("item-collector-completed", () => resolve());
    await using collector = new ItemCollector({
      stream: ReadableStream.from([
        { value: "1" },
        { value: "2" },
        { value: "3" },
      ]),
    });
    collector.start({ signal });
    await promise;
    assertEquals(collector.items, [
      { id: "0", value: "1", detail: {}, decorations: [] },
      { id: "1", value: "2", detail: {}, decorations: [] },
      { id: "2", value: "3", detail: {}, decorations: [] },
    ]);
  });

  await t.step("dispatch 'item-collector-succeeded' on success", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    let called = false;
    using _a = subscribe("item-collector-completed", () => resolve());
    using _b = subscribe("item-collector-succeeded", () => called = true);
    await using collector = new ItemCollector({
      stream: ReadableStream.from([
        { value: "1" },
        { value: "2" },
        { value: "3" },
      ]),
    });
    collector.start({ signal });
    await promise;
    assertEquals(called, true);
  });

  await t.step("dispatch 'item-collector-failed' on failure", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    let called = false;
    using _a = subscribe("item-collector-completed", () => resolve());
    using _b = subscribe("item-collector-failed", () => called = true);
    await using collector = new ItemCollector({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ value: "1" });
          controller.enqueue({ value: "2" });
          controller.error(new Error("test"));
        },
      }),
    });
    collector.start({ signal });
    await promise;
    assertEquals(called, true);
  });

  await t.step(
    "does NOT dispatch 'item-collector-failed' on abort",
    async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      let called = false;
      using _a = subscribe("item-collector-completed", () => resolve());
      using _b = subscribe("item-collector-failed", () => called = true);
      {
        await using collector = new ItemCollector({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ value: "1" });
              controller.enqueue({ value: "2" });
              // Wait forever
            },
          }),
        });
        collector.start({ signal });
        // Disposable will abort the internal stream
      }
      await promise;
      assertEquals(called, false);
    },
  );
});
