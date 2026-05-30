import type { Venue } from "@/db/schema";

export type VenueReminderTipo =
  | "agradecer"
  | "material"
  | "followup"
  | "nova_data"
  | "sem_contato";

export type VenueReminder = {
  venueId: string;
  venueNome: string;
  tipo: VenueReminderTipo;
  texto: string;
};

const DAY = 86_400_000;

/**
 * Gera lembretes de relacionamento por casa a partir das ações já registradas.
 * No máximo 1 lembrete por casa (o de maior prioridade). Pula "não contatar".
 *
 * Prioridade: agradecer show recente > enviar material (quer tocar sem material)
 * > follow-up (material >30d sem retorno) > marcar nova data (saudade >3 meses)
 * > retomar contato (>3 meses sem falar).
 */
export function computeVenueReminders(
  venues: Venue[],
  lastShowByVenue: Map<string, Date>,
  now: Date
): VenueReminder[] {
  const t = now.getTime();
  const out: VenueReminder[] = [];

  for (const v of venues) {
    if (v.naoContatar) continue;

    const lastShow = lastShowByVenue.get(v.id) ?? null;
    const jaTocou = v.jaTocou || !!lastShow;
    const ultimaApr =
      [lastShow, v.ultimaApresentacaoManual]
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    // 1) Agradecer show dos últimos 7 dias (sem agradecimento posterior a ele)
    if (lastShow && t - lastShow.getTime() <= 7 * DAY) {
      const agr = v.agradecimentoEnviadoEm;
      if (!agr || agr.getTime() < lastShow.getTime()) {
        out.push({
          venueId: v.id,
          venueNome: v.nome,
          tipo: "agradecer",
          texto: `Agradecer o show recente em ${v.nome}.`,
        });
        continue;
      }
    }

    // 2) Quer tocar e material ainda não enviado
    if (v.querTocar && !v.materialEnviadoEm) {
      out.push({
        venueId: v.id,
        venueNome: v.nome,
        tipo: "material",
        texto: `Enviar material da banda para ${v.nome}.`,
      });
      continue;
    }

    // 3) Follow-up: material enviado há +30 dias, sem contato posterior e sem show
    if (v.materialEnviadoEm) {
      const dias = Math.floor((t - v.materialEnviadoEm.getTime()) / DAY);
      const semContatoPosterior =
        !v.ultimoContatoEm ||
        v.ultimoContatoEm.getTime() <= v.materialEnviadoEm.getTime();
      if (dias >= 30 && semContatoPosterior && !lastShow) {
        out.push({
          venueId: v.id,
          venueNome: v.nome,
          tipo: "followup",
          texto: `Material enviado há ${dias} dias para ${v.nome} sem retorno — fazer follow-up.`,
        });
        continue;
      }
    }

    // 4) Saudade: já tocou e última apresentação há +3 meses
    if (jaTocou && ultimaApr && t - ultimaApr.getTime() > 90 * DAY) {
      const meses = Math.floor((t - ultimaApr.getTime()) / (30 * DAY));
      out.push({
        venueId: v.id,
        venueNome: v.nome,
        tipo: "nova_data",
        texto: `Faz ~${meses} meses desde o show em ${v.nome}. A banda está com saudade — bora marcar nova data?`,
      });
      continue;
    }

    // 5) Sem contato há muito tempo (só casas de interesse)
    if (v.querTocar || jaTocou) {
      const semContato =
        !v.ultimoContatoEm || t - v.ultimoContatoEm.getTime() > 90 * DAY;
      if (semContato) {
        out.push({
          venueId: v.id,
          venueNome: v.nome,
          tipo: "sem_contato",
          texto: `${v.nome} está há muito tempo sem contato. Avaliar retomar a conversa.`,
        });
        continue;
      }
    }
  }

  return out;
}
