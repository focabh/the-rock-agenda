import { afterEach, describe, expect, it, vi } from "vitest";

// idb e store mockados — testamos só a lógica do runOrQueue
const queuePut = vi.fn(async (..._args: unknown[]) => {});
vi.mock("./idb", () => ({ queuePut: (...a: unknown[]) => queuePut(...a) }));
const refreshPending = vi.fn(async () => {});
vi.mock("./store", () => ({
  useOffline: { getState: () => ({ refreshPending }) },
}));

import { runOrQueue, registerAction } from "./mutations";

function setOnline(v: boolean) {
  vi.stubGlobal("navigator", { onLine: v });
}

afterEach(() => {
  vi.unstubAllGlobals();
  queuePut.mockClear();
  refreshPending.mockClear();
});

describe("runOrQueue", () => {
  it("ONLINE: chama a action e NÃO enfileira", async () => {
    setOnline(true);
    const fn = vi.fn(async () => {});
    registerAction("k_ok", fn);
    const r = await runOrQueue("k_ok", [1, 2]);
    expect(fn).toHaveBeenCalledWith(1, 2);
    expect(r).toEqual({ ok: true, queued: false });
    expect(queuePut).not.toHaveBeenCalled();
  });

  it("ONLINE + action lança: devolve erro e NÃO enfileira (não envenena a fila)", async () => {
    setOnline(true);
    registerAction("k_throw", vi.fn(async () => {
      throw new Error("boom");
    }));
    const r = await runOrQueue("k_throw", []);
    expect(r.ok).toBe(false);
    expect(r.queued).toBe(false);
    expect(queuePut).not.toHaveBeenCalled();
  });

  it("ONLINE + kind desconhecido: erro", async () => {
    setOnline(true);
    const r = await runOrQueue("inexistente", []);
    expect(r.ok).toBe(false);
    expect(queuePut).not.toHaveBeenCalled();
  });

  it("OFFLINE: enfileira com kind/args/label e atualiza pendências", async () => {
    setOnline(false);
    registerAction("k_ok", vi.fn(async () => {}));
    const r = await runOrQueue("k_ok", ["a", { tom: "G" }], { label: "Presença · X" });
    expect(r).toEqual({ ok: true, queued: true });
    expect(queuePut).toHaveBeenCalledTimes(1);
    const item = queuePut.mock.calls[0][0] as unknown as {
      id: string;
      kind: string;
      args: unknown[];
      label?: string;
      createdAt: number;
    };
    expect(item.kind).toBe("k_ok");
    expect(item.args).toEqual(["a", { tom: "G" }]);
    expect(item.label).toBe("Presença · X");
    expect(typeof item.id).toBe("string");
    expect(typeof item.createdAt).toBe("number");
    expect(refreshPending).toHaveBeenCalled();
  });
});
