import "server-only";
import { db } from "@/db";
import { contractorLinkVisits } from "@/db/schema";

/** Pega o IP do visitante a partir dos headers (Vercel/x-forwarded-for). */
export function ipFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "";
}

const PRIVATE = /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1|fe80:|fc|fd)/i;

async function geolocate(
  ip: string
): Promise<{ city: string | null; country: string | null }> {
  if (!ip || PRIVATE.test(ip)) return { city: null, country: null };
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "user-agent": "TheRockApp/1.0" },
      // Cacheia 24h por IP — economiza requests do free tier.
      next: { revalidate: 86400 },
    });
    if (!r.ok) return { city: null, country: null };
    const j = (await r.json()) as {
      city?: string;
      country_name?: string;
      error?: boolean;
    };
    if (j.error) return { city: null, country: null };
    return { city: j.city ?? null, country: j.country_name ?? null };
  } catch {
    return { city: null, country: null };
  }
}

/** Grava uma visita ao link público (executar fire-and-forget). */
export async function logContractorLinkVisit(
  linkId: string,
  ip: string,
  userAgent: string
) {
  const loc = await geolocate(ip);
  await db.insert(contractorLinkVisits).values({
    linkId,
    ip: ip || null,
    userAgent: userAgent ? userAgent.slice(0, 500) : null,
    city: loc.city,
    country: loc.country,
  });
}
