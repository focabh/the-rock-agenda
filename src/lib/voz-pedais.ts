// Catálogo de pedais de voz conhecidos + presets prontos. A ideia é o vocalista
// MEXER O MÍNIMO: ele grava poucas memórias no pedal (uma vez), e por música o
// app só diz qual preset usar (footswitch). A maioria fica no "universal".

export type VozPreset = {
  id: string;
  nome: string;
  slot: string; // como aparece no pedal: "mem 1" (VE-22) ou "Mode 1" (Flamma)
  desc: string; // o que programar no pedal / como soa
  universal?: boolean; // o preset padrão (a maioria das músicas)
};

export type VozPedalModel = {
  id: string;
  nome: string;
  slotLabel: string; // "memória" | "Mode"
  presets: VozPreset[];
};

export const PEDAL_MODELS: Record<string, VozPedalModel> = {
  "boss-ve-22": {
    id: "boss-ve-22",
    nome: "Boss VE-22",
    slotLabel: "memória",
    presets: [
      {
        id: "universal",
        nome: "Universal",
        slot: "mem 1",
        desc: "Voz natural + reverb ambiente leve. Serve pra maioria das músicas.",
        universal: true,
      },
      {
        id: "balada",
        nome: "Balada",
        slot: "mem 2",
        desc: "Reverb Hall + Echo leve. Pra lentas e emotivas.",
      },
      {
        id: "pesada",
        nome: "Pesada / Grunge",
        slot: "mem 3",
        desc: "Reverb curto + leve drive/lo-fi. Pra peso e agressividade.",
      },
      {
        id: "harmonia",
        nome: "Harmonia",
        slot: "mem 4",
        desc: "Vozes de apoio (terças) ligadas. Pra refrões grandes.",
      },
      {
        id: "dobra",
        nome: "Dobra (double)",
        slot: "mem 5",
        desc: "Doubling engrossando a voz. Pra refrões/uníssono fortes.",
      },
      {
        id: "seco",
        nome: "Seco",
        slot: "mem 6",
        desc: "Sem efeito (voz crua). Pra falas e momentos secos.",
      },
    ],
  },
  "flamma-fv02": {
    id: "flamma-fv02",
    nome: "Flamma FV02",
    slotLabel: "Mode",
    presets: [
      {
        id: "universal",
        nome: "Universal",
        slot: "Mode 1 · RM",
        desc: "Room ~20%. Padrão pra maioria.",
        universal: true,
      },
      {
        id: "epica",
        nome: "Épica",
        slot: "Mode 5 · HL",
        desc: "Hall ~40%. Pra baladas/épicas.",
      },
      {
        id: "ambiente",
        nome: "Ambiente",
        slot: "Mode 1 · PL",
        desc: "Plate ~35%. Atmosférico.",
      },
      {
        id: "seco",
        nome: "Seco",
        slot: "OFF",
        desc: "Sem reverb.",
      },
    ],
  },
};

export const DEFAULT_PEDAL_MODEL = "boss-ve-22";

export function getPedalModel(id: string | null | undefined): VozPedalModel | null {
  if (!id) return null;
  return PEDAL_MODELS[id] ?? null;
}

export function getPreset(modelId: string | null | undefined, presetId: string | null | undefined) {
  const m = getPedalModel(modelId);
  if (!m) return null;
  return m.presets.find((p) => p.id === presetId) ?? null;
}

export function universalPreset(modelId: string | null | undefined): VozPreset | null {
  const m = getPedalModel(modelId);
  if (!m) return null;
  return m.presets.find((p) => p.universal) ?? m.presets[0] ?? null;
}
