import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  kvGet,
  kvSet,
  kvDel,
  queuePut,
  queueAll,
  queueDel,
  queueCount,
} from "./idb";

describe("idb · kv", () => {
  it("grava, lê e apaga", async () => {
    await kvSet("snapshot", { a: 1, songs: [1, 2, 3] });
    expect(await kvGet("snapshot")).toEqual({ a: 1, songs: [1, 2, 3] });
    await kvDel("snapshot");
    expect(await kvGet("snapshot")).toBeUndefined();
  });

  it("retorna undefined pra chave inexistente", async () => {
    expect(await kvGet("nada")).toBeUndefined();
  });
});

describe("idb · queue", () => {
  beforeEach(async () => {
    for (const it of await queueAll()) await queueDel(it.id);
  });

  it("enfileira, conta, lista e remove", async () => {
    await queuePut({ id: "1", kind: "setRehearsalPresence", args: ["r", "m", "confirmado"], createdAt: 1 });
    await queuePut({ id: "2", kind: "updateSetlistItem", args: ["s", "i", { tom: "Em" }], createdAt: 2 });
    expect(await queueCount()).toBe(2);

    const all = await queueAll();
    expect(all.map((i) => i.id).sort()).toEqual(["1", "2"]);

    await queueDel("1");
    expect(await queueCount()).toBe(1);
    expect((await queueAll())[0].id).toBe("2");
  });

  it("preserva args estruturados (objetos/arrays)", async () => {
    await queuePut({ id: "x", kind: "reorderSetlistItems", args: ["s", ["a", "b", "c"]], createdAt: 9 });
    const [it] = await queueAll();
    expect(it.args).toEqual(["s", ["a", "b", "c"]]);
  });
});
