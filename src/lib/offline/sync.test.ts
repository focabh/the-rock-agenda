import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// fila e store mockados; controlamos o conteúdo da fila à mão
let queue: { id: string; kind: string; args: unknown[]; createdAt: number }[] = [];
const queueAll = vi.fn(async () => queue.slice());
const queueDel = vi.fn(async (id: string) => {
  queue = queue.filter((i) => i.id !== id);
});
vi.mock("./idb", () => ({
  queueAll: () => queueAll(),
  queueDel: (id: string) => queueDel(id),
}));
const refreshPending = vi.fn(async () => {});
const refresh = vi.fn(async () => {});
vi.mock("./store", () => ({
  useOffline: { getState: () => ({ refreshPending, refresh }) },
}));

import { syncQueue } from "./sync";
import { registerAction } from "./mutations";

beforeEach(() => {
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  queue = [];
  queueAll.mockClear();
  queueDel.mockClear();
  refresh.mockClear();
});

describe("syncQueue", () => {
  it("replica em ordem de createdAt, remove os OK e atualiza o snapshot", async () => {
    const calls: unknown[][] = [];
    registerAction("A", vi.fn(async (...a: unknown[]) => {
      calls.push(a);
    }));
    queue = [
      { id: "2", kind: "A", args: [2], createdAt: 200 },
      { id: "1", kind: "A", args: [1], createdAt: 100 },
    ];
    const r = await syncQueue();
    expect(calls).toEqual([[1], [2]]); // ordenado por createdAt asc
    expect(r.done).toBe(2);
    expect(queue.length).toBe(0);
    expect(refresh).toHaveBeenCalled();
  });

  it("para na 1ª falha preservando a ordem (não perde mutações)", async () => {
    registerAction("B", vi.fn(async () => {
      throw new Error("net");
    }));
    queue = [
      { id: "1", kind: "B", args: [], createdAt: 1 },
      { id: "2", kind: "B", args: [], createdAt: 2 },
    ];
    const r = await syncQueue();
    expect(r.done).toBe(0);
    expect(r.failed).toBe(1);
    expect(queue.length).toBe(2); // nada removido
    expect(refresh).not.toHaveBeenCalled();
  });

  it("descarta kind desconhecido (sem travar a fila)", async () => {
    queue = [{ id: "1", kind: "ZZZ_desconhecido", args: [], createdAt: 1 }];
    const r = await syncQueue();
    expect(queue.length).toBe(0);
    expect(r.done).toBe(0);
    expect(r.failed).toBe(0);
  });

  it("offline: não faz nada", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    registerAction("A", vi.fn(async () => {}));
    queue = [{ id: "1", kind: "A", args: [], createdAt: 1 }];
    const r = await syncQueue();
    expect(r).toEqual({ done: 0, failed: 0 });
    expect(queue.length).toBe(1);
  });
});
