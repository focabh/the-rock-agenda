// Material de estudo "como tocar" por instrumento. A função do músico decide o
// que ele vê em cada música:
//   - Vocal / Manager / sem posição  → letras
//   - Guitarra / Violão / Baixo       → cifra/tab
//   - Teclado / Piano                 → cifra/teclado
//   - Bateria / Percussão             → tab de bateria
// Tudo abre via BUSCA do Google (grátis), com o título limpo (sem
// "- Remastered", "(Live)", etc.) pra cair direto na música — nada de app pago.

export type MaterialKind = "string" | "drum" | "keys";

export type PlayMaterial = {
  kind: MaterialKind;
  label: string;
  provider: string;
  href: (artista: string, titulo: string) => string;
};

export type InstrumentMaterial = {
  play: PlayMaterial | null;
  letrasRelevante: boolean;
};

// Tira sufixos que atrapalham a busca: "- Remastered 2021", "(2022 Remaster)",
// 'From "..."', "- Live...", etc. Fica só o nome real da música.
function tituloLimpo(t: string): string {
  return (t || "")
    .replace(/\s*[-–]\s*(remaster|remastered|live|ao vivo|from|feat|acoustic|mono|stereo|version|edit|deluxe|bonus).*$/i, "")
    .replace(/\s*\((?:[^)]*(remaster|remastered|live|ao vivo|version|edit|deluxe|bonus|feat)[^)]*)\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Ultimate Guitar: catálogo gigante e GRÁTIS (cifras, tabs de guitarra, baixo,
// teclado e bateria). Cai na busca pela música — sem paywall do Cifra Club.
const ug = (a: string, t: string) =>
  `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(
    `${a} ${tituloLimpo(t)}`.trim()
  )}`;

const cifra = ug;
const drumTab = ug;

export function materialForPosicao(
  posicao: string | null | undefined
): InstrumentMaterial {
  const p = (posicao ?? "").toLowerCase();

  if (!p || /manager|empres|produt/.test(p)) return { play: null, letrasRelevante: true };
  if (/vocal|cantor|voz|backing/.test(p)) return { play: null, letrasRelevante: true };

  if (/bateria|bateirist|baterist|drum|percuss/.test(p))
    return {
      play: { kind: "drum", label: "Bateria (tab)", provider: "Ultimate Guitar", href: drumTab },
      letrasRelevante: false,
    };

  if (/teclad|piano|keys|sintet/.test(p))
    return {
      play: { kind: "keys", label: "Cifra / teclado", provider: "Ultimate Guitar", href: cifra },
      letrasRelevante: false,
    };

  // Guitarra, violão, baixo e demais → cifra/tab.
  return {
    play: { kind: "string", label: "Cifra / tab", provider: "Ultimate Guitar", href: cifra },
    letrasRelevante: false,
  };
}
