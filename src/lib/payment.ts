import type { Member } from "@/db/schema";

export type BreakdownInput = {
  cacheCentavos: number;
  applyCommission: boolean;
  commissionPct: number; // 0..100
  confirmedMusicos: Member[];
  managerMember: Member | null;
  overrides: Map<string, number>; // memberId -> valor em centavos
};

export type BreakdownResult = {
  cacheCentavos: number;
  managerCentavos: number;
  remainingCentavos: number; // disponível para músicos
  perMember: Map<string, { valorCentavos: number; manual: boolean }>;
  // Soma final dos pagamentos (manager + músicos). Pode diferir do cachê
  // se houver overrides que estourem o limite — UI deve sinalizar.
  totalPagoCentavos: number;
  overflow: boolean;
};

export function computePaymentBreakdown(input: BreakdownInput): BreakdownResult {
  const { cacheCentavos, applyCommission, commissionPct, confirmedMusicos, overrides } = input;

  const managerCentavos =
    applyCommission && cacheCentavos > 0
      ? Math.round((cacheCentavos * commissionPct) / 100)
      : 0;

  const remaining = Math.max(0, cacheCentavos - managerCentavos);

  // Soma os overrides
  let overriddenTotal = 0;
  const overriddenIds = new Set<string>();
  for (const m of confirmedMusicos) {
    if (overrides.has(m.id)) {
      overriddenTotal += overrides.get(m.id)!;
      overriddenIds.add(m.id);
    }
  }

  const autoMusicos = confirmedMusicos.filter((m) => !overriddenIds.has(m.id));
  const remainingForAuto = remaining - overriddenTotal;

  // Auto share = igual para todos os auto-músicos
  const baseShare =
    autoMusicos.length > 0 && remainingForAuto > 0
      ? Math.floor(remainingForAuto / autoMusicos.length)
      : 0;

  const perMember = new Map<string, { valorCentavos: number; manual: boolean }>();
  for (const m of confirmedMusicos) {
    if (overrides.has(m.id)) {
      perMember.set(m.id, { valorCentavos: overrides.get(m.id)!, manual: true });
    } else {
      perMember.set(m.id, { valorCentavos: baseShare, manual: false });
    }
  }

  // Resíduo de arredondamento → adiciona ao primeiro auto-músico
  if (autoMusicos.length > 0 && remainingForAuto > 0) {
    const allocated = baseShare * autoMusicos.length;
    const diff = remainingForAuto - allocated;
    if (diff !== 0) {
      const first = autoMusicos[0];
      const cur = perMember.get(first.id)!;
      perMember.set(first.id, {
        valorCentavos: cur.valorCentavos + diff,
        manual: cur.manual,
      });
    }
  }

  const musicosTotal = [...perMember.values()].reduce(
    (s, v) => s + v.valorCentavos,
    0
  );
  const totalPagoCentavos = managerCentavos + musicosTotal;
  const overflow = totalPagoCentavos > cacheCentavos;

  return {
    cacheCentavos,
    managerCentavos,
    remainingCentavos: remaining,
    perMember,
    totalPagoCentavos,
    overflow,
  };
}
