// Material de estudo "como tocar" por instrumento da banda. A função do músico
// (members.funcao / userPosicao) decide o que ele vê em cada música:
//   - Vocal / Manager / sem posição  → letras
//   - Guitarra / Violão              → cifra/tab (Cifra Club)
//   - Baixo                          → tab de baixo (Cifra Club)
//   - Teclado / Piano                → cifra/teclado (Cifra Club)
//   - Bateria / Percussão            → tab de bateria (Songsterr — Cifra Club não tem)
// PURA — sem dependências de UI (o componente mapeia `kind` → ícone/cor).

export type MaterialKind = "string" | "drum" | "keys";

export type PlayMaterial = {
  kind: MaterialKind;
  label: string;
  provider: string;
  href: (artista: string, titulo: string) => string;
};

export type InstrumentMaterial = {
  /** Link externo de "como tocar" pro instrumento (null p/ vocal/manager). */
  play: PlayMaterial | null;
  /** Letras são o material principal desta função (vocal/manager/sem posição). */
  letrasRelevante: boolean;
};

const q = (a: string, t: string) =>
  encodeURIComponent(`${a ?? ""} ${t ?? ""}`.trim());

const cifraClub = (a: string, t: string) =>
  `https://www.cifraclub.com.br/?q=${q(a, t)}`;
const songsterr = (a: string, t: string) =>
  `https://www.songsterr.com/?pattern=${q(a, t)}`;

export function materialForPosicao(
  posicao: string | null | undefined
): InstrumentMaterial {
  const p = (posicao ?? "").toLowerCase();

  if (!p || /manager|empres|produt/.test(p))
    return { play: null, letrasRelevante: true };
  if (/vocal|cantor|voz|backing/.test(p))
    return { play: null, letrasRelevante: true };

  if (/bateria|bateirist|baterist|drum|percuss/.test(p))
    return {
      play: { kind: "drum", label: "Bateria", provider: "Songsterr", href: songsterr },
      letrasRelevante: false,
    };

  if (/baixo|bass|contrabaix/.test(p))
    return {
      play: { kind: "string", label: "Baixo (tab)", provider: "Cifra Club", href: cifraClub },
      letrasRelevante: false,
    };

  if (/teclad|piano|keys|sintet/.test(p))
    return {
      play: { kind: "keys", label: "Teclado / cifra", provider: "Cifra Club", href: cifraClub },
      letrasRelevante: false,
    };

  // Guitarra, violão e demais instrumentos de corda → cifra/tab.
  return {
    play: { kind: "string", label: "Cifra / tab", provider: "Cifra Club", href: cifraClub },
    letrasRelevante: false,
  };
}
