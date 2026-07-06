import { describe, it, expect } from "vitest";
import { parseTomNum, tomTone } from "./tom";

describe("parseTomNum", () => {
  it("interpreta original/vazio/números/sinal", () => {
    expect(parseTomNum("Original")).toBe(0);
    expect(parseTomNum("0")).toBe(0);
    expect(parseTomNum("-2")).toBe(-2);
    expect(parseTomNum("+1")).toBe(1);
    expect(parseTomNum("")).toBeNull();
    expect(parseTomNum(null)).toBeNull();
    expect(parseTomNum("xyz")).toBeNull();
  });
});

describe("tomTone", () => {
  it("tom desconhecido → plain; original (0) → original", () => {
    expect(tomTone(null, "-1")).toBe("plain");
    expect(tomTone("0", "-1")).toBe("original");
  });
  it("sem padrão configurado → padrão (comportamento antigo, âmbar)", () => {
    expect(tomTone("-2", null)).toBe("padrao");
  });
  it("colore pela distância do padrão da banda", () => {
    expect(tomTone("-1", "-1")).toBe("padrao"); // igual
    expect(tomTone("-2", "-1")).toBe("orange"); // 1 a mais dropado
    expect(tomTone("-3", "-1")).toBe("red"); // 2+ a mais dropado
    expect(tomTone("-4", "-1")).toBe("red");
    expect(tomTone("1", "-1")).toBe("up"); // mais alto que o padrão
  });
  it("original vence mesmo com padrão dropado", () => {
    expect(tomTone("0", "-2")).toBe("original");
  });
});
