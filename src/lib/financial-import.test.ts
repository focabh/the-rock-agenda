import { describe, expect, it } from "vitest";
import { normalizeAiRows } from "./financial-import";

const NOW = Date.UTC(2026, 5, 10, 12, 0, 0); // 2026-06-10

describe("normalizeAiRows", () => {
  it("converte valor BRL string em centavos", () => {
    const [g] = normalizeAiRows([{ descricao: "Cordas", valor: "150,00", data: "12/03/2026" }], NOW);
    expect(g.valorCentavos).toBe(15000);
    expect(g.descricao).toBe("Cordas");
    expect(g.paidEmISO.startsWith("2026-03-12")).toBe(true);
    expect(g.tipo).toBe("extra");
  });

  it("aceita valor numérico e milhar", () => {
    const [a] = normalizeAiRows([{ descricao: "PA", valor: 1200.5 }], NOW);
    expect(a.valorCentavos).toBe(120050);
    const [b] = normalizeAiRows([{ descricao: "Van", valor: "1.200,50" }], NOW);
    expect(b.valorCentavos).toBe(120050);
  });

  it("descarta linhas sem valor positivo (totais/cabeçalhos)", () => {
    const rows = normalizeAiRows(
      [
        { descricao: "Cabeçalho", valor: "" },
        { descricao: "Total", valor: "0" },
        { descricao: "Gasolina", valor: "R$ 80,00" },
      ],
      NOW
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].descricao).toBe("Gasolina");
  });

  it("usa a data de hoje como fallback quando não há data", () => {
    const [g] = normalizeAiRows([{ descricao: "X", valor: "10,00" }], NOW);
    expect(g.paidEmISO.startsWith("2026-06-10")).toBe(true);
  });

  it("reconhece tipo show e usa descrição como recipient quando ausente", () => {
    const [g] = normalizeAiRows([{ descricao: "Cachê sonorização do show", valor: "300", tipo: "show" }], NOW);
    expect(g.tipo).toBe("show");
    expect(g.recipient).toBe("Cachê sonorização do show");
  });

  it("entende datas ISO e DD-MM-AA", () => {
    const [iso] = normalizeAiRows([{ descricao: "A", valor: "1", data: "2026-01-05" }], NOW);
    expect(iso.paidEmISO.startsWith("2026-01-05")).toBe(true);
    const [br] = normalizeAiRows([{ descricao: "B", valor: "1", data: "05-01-26" }], NOW);
    expect(br.paidEmISO.startsWith("2026-01-05")).toBe(true);
  });
});
