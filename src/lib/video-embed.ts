// Detecta o provedor do vídeo e devolve uma URL de embed (iframe-friendly).
// Cobre os 3 mais usados por banda amadora: YouTube, Vimeo e Google Drive.
// Outros providers caem em null (tratados como link clicável).

export type VideoEmbed =
  | { kind: "embed"; provider: "youtube" | "vimeo" | "drive"; src: string }
  | { kind: "link" };

export function detectVideoEmbed(url: string): VideoEmbed {
  // YouTube — watch?v=, embed/, shorts/, youtu.be/
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  if (yt) {
    // youtube-nocookie.com não solta cookies de tracking até o usuário
    // interagir com o player. Mesma API, menos exposição pra LGPD.
    return {
      kind: "embed",
      provider: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${yt[1]}`,
    };
  }
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) {
    return {
      kind: "embed",
      provider: "vimeo",
      src: `https://player.vimeo.com/video/${vm[1]}`,
    };
  }
  // Google Drive (/file/d/{id}/...)
  const dr = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (dr) {
    return {
      kind: "embed",
      provider: "drive",
      src: `https://drive.google.com/file/d/${dr[1]}/preview`,
    };
  }
  return { kind: "link" };
}
