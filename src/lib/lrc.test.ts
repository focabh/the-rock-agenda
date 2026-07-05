import { describe, it, expect } from "vitest";
import {
  parseLrc,
  buildTimeline,
  activeLineIndex,
  decideEntryWarning,
  suggestCues,
  type TimelineEntry,
} from "./lrc";

// Versos fictícios de propósito (nada de letra real).
describe("parseLrc", () => {
  it("parseia, ordena por tempo e mantém linhas vazias (respiros)", () => {
    const lrc = ["[00:10.00]linha B", "[00:05.00]linha A", "[00:07.50]"].join("\n");
    const out = parseLrc(lrc);
    expect(out.map((l) => l.t)).toEqual([5, 7.5, 10]);
    expect(out[0].text).toBe("linha A");
    expect(out[1].text).toBe(""); // linha vazia preservada
  });

  it("suporta múltiplos timestamps na mesma linha", () => {
    const out = parseLrc("[00:01.00][00:03.00]refrão");
    expect(out).toHaveLength(2);
    expect(out.map((l) => l.t)).toEqual([1, 3]);
    expect(out.every((l) => l.text === "refrão")).toBe(true);
  });

  it("aplica [offset:+ms] adiantando a letra (subtrai do tempo)", () => {
    const out = parseLrc("[offset:500]\n[00:10.00]linha");
    expect(out[0].t).toBeCloseTo(9.5, 5);
  });

  it("aplica [offset:-ms] atrasando a letra (soma ao tempo)", () => {
    const out = parseLrc("[offset:-500]\n[00:10.00]linha");
    expect(out[0].t).toBeCloseTo(10.5, 5);
  });

  it("nunca gera tempo negativo por causa do offset", () => {
    const out = parseLrc("[offset:99999]\n[00:01.00]linha");
    expect(out[0].t).toBe(0);
  });

  it("ignora linhas sem timestamp e entradas vazias/nulas", () => {
    expect(parseLrc(null)).toEqual([]);
    expect(parseLrc("")).toEqual([]);
    expect(parseLrc("só metadados\n[ti:Título]")).toEqual([]);
  });

  it("aceita centésimos e milésimos", () => {
    const out = parseLrc("[00:02.5]a\n[00:02.250]b");
    expect(out.map((l) => l.t)).toEqual([2.25, 2.5]);
  });
});

describe("activeLineIndex", () => {
  const lines = [{ t: 0 }, { t: 5 }, { t: 10 }];
  it("retorna -1 na introdução (antes do 1º verso com t>0)", () => {
    expect(activeLineIndex([{ t: 5 }, { t: 10 }], 2)).toBe(-1);
  });
  it("pega a última linha cujo tempo já passou", () => {
    expect(activeLineIndex(lines, 0)).toBe(0);
    expect(activeLineIndex(lines, 4.9)).toBe(0);
    expect(activeLineIndex(lines, 5)).toBe(1);
    expect(activeLineIndex(lines, 999)).toBe(2);
  });
  it("com timestamps duplicados escolhe o último igual", () => {
    expect(activeLineIndex([{ t: 0 }, { t: 5 }, { t: 5 }, { t: 9 }], 5)).toBe(2);
  });
});

describe("buildTimeline", () => {
  it("mescla versos + marcações, ordena e sinaliza cue", () => {
    const lines = parseLrc("[00:00.00]verso\n[00:20.00]\n[00:30.00]refrão");
    const tl = buildTimeline(lines, [{ t: 10, label: "Solo" }]);
    // linha vazia (t=20) é filtrada; sobram verso(0), Solo(10, cue), refrão(30)
    expect(tl.map((e) => [e.t, e.cue])).toEqual([
      [0, false],
      [10, true],
      [30, false],
    ]);
  });
});

describe("decideEntryWarning", () => {
  const tl: TimelineEntry[] = [
    { t: 0, text: "verso", cue: false },
    { t: 30, text: "refrão", cue: false },
  ];
  it("modo limpo nunca avisa", () => {
    expect(decideEntryWarning(tl, 25, "limpo").shouldShowWarning).toBe(false);
  });
  it("timeline vazia não avisa", () => {
    expect(decideEntryWarning([], 10, "show").shouldShowWarning).toBe(false);
  });
  it("show: avisa só perto da entrada após vão relevante", () => {
    expect(decideEntryWarning(tl, 10, "show").shouldShowWarning).toBe(false); // longe
    const w = decideEntryWarning(tl, 25, "show"); // 5s antes, gap 30
    expect(w.shouldShowWarning).toBe(true);
    expect(w.warningText).toContain("5");
  });
  it("show: vão curto (refrão colado) não avisa", () => {
    const curto: TimelineEntry[] = [
      { t: 0, text: "a", cue: false },
      { t: 5, text: "b", cue: false },
    ];
    expect(decideEntryWarning(curto, 4, "show").shouldShowWarning).toBe(false);
  });
  it("ensaio: mais informativo (avisa mesmo longe, se vão perceptível)", () => {
    expect(decideEntryWarning(tl, 10, "ensaio").shouldShowWarning).toBe(true);
  });
  it("não avisa quando não há mais vocal à frente", () => {
    expect(decideEntryWarning(tl, 40, "show").shouldShowWarning).toBe(false);
  });
});

describe("suggestCues", () => {
  it("sugere introdução longa e instrumentais nos vãos", () => {
    const lines = parseLrc("[00:12.00]entra\n[00:60.00]volta");
    const cues = suggestCues(lines);
    expect(cues.some((c) => c.label === "Introdução")).toBe(true);
    expect(cues.some((c) => c.label === "Instrumental")).toBe(true);
  });
});
