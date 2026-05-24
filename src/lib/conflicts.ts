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

/** Cor estável por id (HSL com matiz derivada do hash) */
export function colorForMember(id: string): { bg: string; text: string; ring: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return {
    bg: `hsl(${h} 70% 45% / 0.2)`,
    text: `hsl(${h} 80% 75%)`,
    ring: `hsl(${h} 70% 50% / 0.45)`,
  };
}
