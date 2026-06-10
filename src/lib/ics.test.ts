import { describe, expect, it } from "vitest";
import { buildIcs, parseIcs } from "./ics";

const STAMP = "2026-06-10T12:00:00.000Z";

describe("ics · buildIcs", () => {
  it("gera VCALENDAR com VEVENT e horário (floating local)", () => {
    const ics = buildIcs(
      "Agenda",
      [{ uid: "x@a", start: new Date("2026-06-13T12:00:00Z"), startTime: "20:30", endTime: "22:40", summary: "Show", location: "Bar" }],
      STAMP
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:x@a");
    expect(ics).toContain("DTSTART:20260613T203000");
    expect(ics).toContain("DTEND:20260613T224000");
    expect(ics).toContain("SUMMARY:Show");
    expect(ics).toContain("LOCATION:Bar");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("evento sem hora vira all-day (VALUE=DATE)", () => {
    const ics = buildIcs("A", [{ uid: "d@a", start: new Date("2026-07-01T15:00:00Z"), summary: "Ensaio" }], STAMP);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260701");
  });

  it("escapa vírgula/; e dobra linha longa", () => {
    const longa = "Show especial, com detalhes; e uma descrição muito muito muito muito muito muito longa que passa de 75 colunas tranquilo";
    const ics = buildIcs("A", [{ uid: "l@a", start: new Date("2026-06-13T12:00:00Z"), startTime: "21:00", summary: "Show", description: longa }], STAMP);
    expect(ics).toContain("\\,"); // vírgula escapada
    expect(ics).toContain("\\;"); // ponto-e-vírgula escapado
    // linha dobrada: deve haver continuação iniciada por espaço
    expect(/\r\n /.test(ics)).toBe(true);
  });
});

describe("ics · parseIcs", () => {
  it("faz parse de VEVENT com hora", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:1",
      "SUMMARY:Ensaio da banda",
      "LOCATION:Casa do Foca",
      "DTSTART:20260613T203000",
      "DTEND:20260613T223000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [e] = parseIcs(text);
    expect(e.summary).toBe("Ensaio da banda");
    expect(e.location).toBe("Casa do Foca");
    expect(e.startTime).toBe("20:30");
    expect(e.allDay).toBe(false);
    expect(e.start).toBeInstanceOf(Date);
  });

  it("reconhece all-day", () => {
    const text = "BEGIN:VEVENT\r\nUID:2\r\nSUMMARY:Feriado\r\nDTSTART;VALUE=DATE:20260701\r\nEND:VEVENT";
    const [e] = parseIcs(text);
    expect(e.allDay).toBe(true);
    expect(e.startTime).toBeNull();
  });

  it("desfaz escapes e desdobra linhas continuadas", () => {
    const text = [
      "BEGIN:VEVENT",
      "UID:3",
      "SUMMARY:Show especial\\, parte 1",
      "DESCRIPTION:linha um\\nlinha dois com texto que cont",
      " inua na proxima",
      "DTSTART:20260613T210000",
      "END:VEVENT",
    ].join("\r\n");
    const [e] = parseIcs(text);
    expect(e.summary).toBe("Show especial, parte 1");
    expect(e.description).toContain("linha um\nlinha dois");
    expect(e.description).toContain("continua na proxima");
  });

  it("round-trip: buildIcs → parseIcs preserva os campos", () => {
    const ics = buildIcs(
      "Agenda",
      [{ uid: "rt@a", start: new Date("2026-06-13T12:00:00Z"), startTime: "20:30", summary: "Porks, Cidade Nova", location: "Av. X; 100" }],
      STAMP
    );
    const [e] = parseIcs(ics);
    expect(e.summary).toBe("Porks, Cidade Nova");
    expect(e.location).toBe("Av. X; 100");
    expect(e.startTime).toBe("20:30");
  });
});
