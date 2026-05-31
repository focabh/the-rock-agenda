import type { Member, MemberUnavailability } from "@/db/schema";

const BR_TZ = "America/Sao_Paulo";
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BR_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD na zona horária brasileira (perspectiva do usuário) */
export function brDateKey(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  return fmt.format(date);
}

export function membersUnavailableOn(
  date: Date | number,
  blocks: MemberUnavailability[],
  members: Member[]
): Member[] {
  const showKey = brDateKey(date);
  const blocked = new Set(
    blocks
      .filter((b) => {
        const startKey = brDateKey(b.dataInicio);
        const endKey = brDateKey(b.dataFim);
        return startKey <= showKey && showKey <= endKey;
      })
      .map((b) => b.memberId)
  );
  return members.filter((m) => blocked.has(m.id));
}

// Paleta de matizes BEM distintas entre si (espalhadas pela roda de cores).
// Evita o vermelho dos shows e o verde dos ensaios nos primeiros slots.
const MEMBER_HUES = [
  195, // ciano
  275, // violeta
  30, // laranja
  320, // magenta
  230, // azul
  60, // amarelo-ouro
  160, // teal
  345, // rosa
];

function hueColor(h: number) {
  return {
    bg: `hsl(${h} 72% 45% / 0.24)`,
    text: `hsl(${h} 85% 80%)`,
    ring: `hsl(${h} 72% 55% / 0.55)`,
  };
}

/**
 * Cor estável e DISTINTA por membro. Passe `index` (posição do membro na lista)
 * pra garantir cores muito diferentes entre si — é o que a legenda/agenda usam.
 * Sem index, cai num hash discreto na mesma paleta (consistente, mas pode
 * colidir com muitos membros).
 */
export function colorForMember(
  id: string,
  index?: number
): { bg: string; text: string; ring: string } {
  let slot: number;
  if (index != null && index >= 0) {
    slot = index % MEMBER_HUES.length;
  } else {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    slot = h % MEMBER_HUES.length;
  }
  return hueColor(MEMBER_HUES[slot]);
}
