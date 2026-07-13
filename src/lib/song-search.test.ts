import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  rankTracks,
  requestedVariants,
  artistNameMatchesQuery,
  norm,
  searchTracks,
  _resetSearchCaches,
} from "./song-search";

// Fixtures curtas (RawTrack mínimo).
const t = (trackName: string, artistName: string, collectionName?: string) => ({
  trackName,
  artistName,
  collectionName,
});

// ---------------------------------------------------------------------------
// Ranking PURO — sem rede.
// ---------------------------------------------------------------------------
describe("rankTracks", () => {
  it("creep radiohead → estúdio do Radiohead no topo (não o acústico/cover/karaokê)", () => {
    const r = rankTracks("creep radiohead", {
      song: [
        t("Creep (Acoustic)", "Radiohead", "Creep - EP"),
        t("Creep (Radiohead Cover)", "Sunfly House Band"),
        t("Creep", "Stone Temple Pilots"),
        t("Creep - Radiohead (Piano Karaoke)", "KaraoKeysPH"),
      ],
      catalog: [t("Creep", "Radiohead", "Pablo Honey")],
      artistNames: ["Radiohead"],
    });
    expect(r[0].titulo).toBe("Creep");
    expect(r[0].artista).toBe("Radiohead");
  });

  it("creep acoustic radiohead → prioriza a versão ACÚSTICA (intenção explícita)", () => {
    const r = rankTracks("creep acoustic radiohead", {
      song: [t("Creep", "Stone Temple Pilots")],
      catalog: [
        t("Creep", "Radiohead", "Pablo Honey"),
        t("Creep (Acoustic)", "Radiohead", "Creep - EP"),
      ],
      artistNames: ["Radiohead"],
    });
    expect(r[0].titulo).toBe("Creep (Acoustic)");
    expect(r[0].artista).toBe("Radiohead");
  });

  it("creep live radiohead → prioriza versão AO VIVO", () => {
    const r = rankTracks("creep live radiohead", {
      song: [],
      catalog: [
        t("Creep", "Radiohead", "Pablo Honey"),
        t("Creep (Live in Praha)", "Radiohead", "I Might Be Wrong"),
      ],
      artistNames: ["Radiohead"],
    });
    expect(r[0].titulo).toBe("Creep (Live in Praha)");
  });

  it("wonderwall oasis → Wonderwall do Oasis (não unplugged/remaster/cover)", () => {
    const r = rankTracks("wonderwall oasis", {
      song: [t("Wonderwall", "Ryan Adams")],
      catalog: [
        t("Wonderwall (Unplugged)", "Oasis"),
        t("Wonderwall", "Oasis", "(What's the Story) Morning Glory?"),
        t("Wonderwall (Remastered)", "Oasis"),
      ],
      artistNames: ["Oasis"],
    });
    expect(r[0].titulo).toBe("Wonderwall");
    expect(r[0].artista).toBe("Oasis");
  });

  it("zombie cranberries → Zombie de The Cranberries (mesmo digitando sem 'The')", () => {
    const r = rankTracks("zombie cranberries", {
      song: [t("Zombie (Live)", "The Cranberries"), t("Zombie", "Bad Wolves")],
      catalog: [t("Zombie", "The Cranberries", "No Need to Argue")],
      artistNames: ["The Cranberries"],
    });
    expect(r[0].titulo).toBe("Zombie");
    expect(r[0].artista).toBe("The Cranberries");
  });

  it("black pearl jam → 'Black' (não outra faixa do mesmo álbum)", () => {
    const r = rankTracks("black pearl jam", {
      song: [],
      catalog: [
        t("Alive", "Pearl Jam", "Ten"),
        t("Jeremy", "Pearl Jam", "Ten"),
        t("Black", "Pearl Jam", "Ten"),
      ],
      artistNames: ["Pearl Jam"],
    });
    expect(r[0].titulo).toBe("Black");
  });

  it("alive pearl jam → 'Alive' NÃO é confundido com versão ao vivo (\\blive\\b)", () => {
    const r = rankTracks("alive pearl jam", {
      song: [],
      catalog: [
        t("Black", "Pearl Jam", "Ten"),
        t("Alive", "Pearl Jam", "Ten"),
        t("Alive (Live)", "Pearl Jam", "Live On Two Legs"),
      ],
      artistNames: ["Pearl Jam"],
    });
    expect(r[0].titulo).toBe("Alive"); // versão de estúdio, não a "(Live)"
  });

  it("creep (só o título) → ambíguo, sem promessa de artista, mas não promove karaokê/acústico", () => {
    const r = rankTracks("creep", {
      song: [
        t("Creep (Acoustic)", "Radiohead"),
        t("Creep", "Stone Temple Pilots"),
        t("Creep - Karaoke", "The Karaoke Crew"),
        t("Creep", "TLC"),
      ],
      catalog: [],
      artistNames: [],
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].titulo).not.toBe("Creep (Acoustic)");
    expect(norm(r[0].artista)).not.toContain("karaoke");
  });
});

// ---------------------------------------------------------------------------
// Intenção explícita de versão.
// ---------------------------------------------------------------------------
describe("requestedVariants", () => {
  it("detecta a variante digitada", () => {
    expect([...requestedVariants("creep acoustic radiohead")]).toContain("acoustic");
    expect([...requestedVariants("creep live radiohead")]).toContain("live");
    expect([...requestedVariants("wonderwall karaoke")]).toContain("karaoke");
  });
  it("NÃO confunde 'alive' com 'live'", () => {
    expect(requestedVariants("alive pearl jam").has("live")).toBe(false);
  });
  it("sem variante quando não foi pedida", () => {
    expect(requestedVariants("creep radiohead").size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Resolução de artista: nomes compostos/pontuados/acentuados (#3) e conservadora (#2).
// ---------------------------------------------------------------------------
describe("artistNameMatchesQuery", () => {
  const matches: [string, string][] = [
    ["mr brightside the killers", "The Killers"],
    ["no one knows queens of the stone age", "Queens of the Stone Age"],
    ["losing my religion r.e.m.", "R.E.M."],
    ["highway to hell ac/dc", "AC/DC"],
    ["sweet child o mine guns n' roses", "Guns N' Roses"],
    ["under the bridge red hot chili peppers", "Red Hot Chili Peppers"],
    ["would alice in chains", "Alice in Chains"],
    ["everlong foo fighters", "Foo Fighters"],
    ["chop suey system of a down", "System of a Down"],
    ["zombie cranberries", "The Cranberries"],
  ];
  it.each(matches)("casa '%s' → %s", (q, name) => {
    expect(artistNameMatchesQuery(q, name)).toBe(true);
  });

  it("conservador: 'queen' não casa 'Queens of the Stone Age' (limite de palavra)", () => {
    expect(artistNameMatchesQuery("no one knows queen", "Queens of the Stone Age")).toBe(false);
  });
  it("conservador: artista que não aparece na query não casa", () => {
    expect(artistNameMatchesQuery("creep radiohead", "Stone Temple Pilots")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IO — searchTracks com fetch MOCKADO (determinístico).
// ---------------------------------------------------------------------------
// Faixa com artistId (o /search do iTunes traz isso e a expansão usa).
const ti = (trackName: string, artistName: string, artistId: number, collectionName?: string) => ({
  trackName,
  artistName,
  artistId,
  collectionName,
});

function makeFetch(opts: {
  song?: Record<string, unknown>[];
  catalogs?: Record<number, Record<string, unknown>[]>; // artistId → faixas
  hangLookup?: boolean;
  failLookup?: boolean;
  failSong?: boolean;
}) {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname.includes("/lookup")) {
      if (opts.hangLookup) return new Promise(() => {}) as never; // nunca resolve
      if (opts.failLookup) return { ok: false };
      const id = Number(u.searchParams.get("id"));
      return { ok: true, json: async () => ({ results: opts.catalogs?.[id] ?? [] }) };
    }
    // entity=song
    if (opts.failSong) return { ok: false };
    return { ok: true, json: async () => ({ results: opts.song ?? [] }) };
  });
}

describe("searchTracks (IO mockado)", () => {
  const realFetch = global.fetch;
  beforeEach(() => _resetSearchCaches());
  afterEach(() => {
    global.fetch = realFetch;
    vi.useRealTimers();
  });

  it("resposta vazia → []", async () => {
    global.fetch = makeFetch({ song: [] }) as never;
    expect(await searchTracks("qualquer coisa")).toEqual([]);
  });

  it("/search falha → [] sem quebrar", async () => {
    global.fetch = makeFetch({ failSong: true }) as never;
    expect(await searchTracks("creep radiohead")).toEqual([]);
  });

  it("lookup de catálogo falha → degrada pros resultados normais", async () => {
    global.fetch = makeFetch({
      song: [ti("Creep", "Stone Temple Pilots", 9), ti("Creep (Acoustic)", "Radiohead", 2)],
      failLookup: true,
    }) as never;
    const r = await searchTracks("creep radiohead");
    expect(r.length).toBeGreaterThan(0); // não quebrou; veio da busca normal
  });

  it("descobre o artista pelo artistId dos resultados e traz o estúdio do catálogo", async () => {
    global.fetch = makeFetch({
      song: [ti("Creep (Acoustic)", "Radiohead", 2), ti("Creep", "Stone Temple Pilots", 9)],
      catalogs: { 2: [t("Creep", "Radiohead", "Pablo Honey"), t("Karma Police", "Radiohead")] },
    }) as never;
    const r = await searchTracks("creep radiohead");
    expect(r[0].titulo).toBe("Creep");
    expect(r[0].artista).toBe("Radiohead");
  });

  it("homônimo: artista 'Creep' que aparece nos resultados NÃO polui (catálogo filtrado)", async () => {
    global.fetch = makeFetch({
      song: [
        ti("Holdin On", "Creep", 1), // artista literalmente "Creep"
        ti("Creep (Acoustic)", "Radiohead", 2),
      ],
      catalogs: {
        1: [t("Holdin On", "Creep")], // nada com "radiohead" no título → filtrado
        2: [t("Creep", "Radiohead", "Pablo Honey")],
      },
    }) as never;
    const r = await searchTracks("creep radiohead");
    expect(r[0].titulo).toBe("Creep");
    expect(r[0].artista).toBe("Radiohead");
  });

  it("artista inexistente nos resultados → sem catálogo, ainda retorna a busca normal", async () => {
    global.fetch = makeFetch({ song: [ti("Xyz", "Fulano", 7)] }) as never;
    const r = await searchTracks("xyz banda que nao existe");
    expect(r.length).toBeGreaterThan(0);
  });

  it("no máximo 2 lookups de catálogo (termo longo / vários artistas não estoura chamadas)", async () => {
    const f = makeFetch({
      song: [
        ti("A", "Alfa", 1),
        ti("B", "Beta", 2),
        ti("C", "Gama", 3),
      ],
      catalogs: { 1: [], 2: [], 3: [] },
    });
    global.fetch = f as never;
    // 3 artistas batem, mas só 2 lookups devem sair.
    await searchTracks("alfa beta gama uma duas tres");
    const lookups = f.mock.calls.filter((c) => String(c[0]).includes("/lookup")).length;
    expect(lookups).toBeLessThanOrEqual(2);
  });

  it("timeout do catálogo (lookup pendura) → degrada pros resultados normais", async () => {
    vi.useFakeTimers();
    global.fetch = makeFetch({
      song: [ti("Creep", "Stone Temple Pilots", 9), ti("Creep (Acoustic)", "Radiohead", 2)],
      hangLookup: true,
    }) as never;
    const p = searchTracks("creep radiohead");
    await vi.advanceTimersByTimeAsync(3000); // passa do budget de catálogo
    const r = await p;
    expect(r.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// SMOKE opcional contra o iTunes REAL. Não roda no `verify` (precisa de rede).
// Rodar com: ITUNES_SMOKE=1 npx vitest run src/lib/song-search.test.ts
// ---------------------------------------------------------------------------
describe.skipIf(!process.env.ITUNES_SMOKE)("smoke: iTunes real", () => {
  beforeEach(() => _resetSearchCaches());
  it("creep radiohead → Creep de Radiohead (estúdio) no topo", async () => {
    const r = await searchTracks("creep radiohead");
    expect(norm(r[0].artista)).toContain("radiohead");
    expect(norm(r[0].titulo)).toBe("creep");
  }, 15000);
  it("wonderwall oasis → Wonderwall de Oasis no topo", async () => {
    const r = await searchTracks("wonderwall oasis");
    expect(norm(r[0].artista)).toBe("oasis");
    expect(norm(r[0].titulo)).toBe("wonderwall");
  }, 15000);
});
