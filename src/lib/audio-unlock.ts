// Destrava o áudio (Web Audio) no mobile. Dois bloqueios clássicos:
//  1) O AudioContext nasce "suspended" até um gesto do usuário → resume().
//  2) iPhone: o botão físico de silencioso muta o Web Audio mesmo com o
//     volume no máximo. `navigator.audioSession.type = "playback"` (iOS 16.4+)
//     faz o som tocar como mídia, ignorando o silencioso.
// Tocar um buffer mudo confirma o desbloqueio. Chamar SEMPRE dentro do gesto
// (ex.: no clique de "Iniciar") pra valer como interação do usuário.
export async function prepareAudioContext(ctx: AudioContext): Promise<void> {
  try {
    const ns = navigator as unknown as { audioSession?: { type?: string } };
    if (ns.audioSession && ns.audioSession.type !== "playback") {
      ns.audioSession.type = "playback";
    }
  } catch {
    /* iOS antigo / sem suporte — segue o jogo */
  }
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}
