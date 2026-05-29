import Link from "next/link";
import { asc, eq, inArray, isNotNull, and } from "drizzle-orm";
import { headers } from "next/headers";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { promoItems, users } from "@/db/schema";
import { getCurrentUser, getLogoUrl } from "@/lib/auth";
import { PressKitSection } from "@/components/contratantes/press-kit-section";
import { VideoPlayer } from "@/components/contratantes/video-player";
import { InstagramIcon } from "@/components/shared/icons";
import { ipFromHeaders, logSiteVisit } from "@/lib/visit-logger";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "The Rock — Material da banda",
    robots: { index: false, follow: false },
  };
}

function extractIgHandle(url: string): string {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  if (!m) return "";
  const h = m[1].trim();
  if (["p", "reel", "reels", "explore", "tv", "stories"].includes(h.toLowerCase()))
    return "";
  return h.startsWith("@") ? h.slice(1) : h;
}

function onlyDigits(s: string): string {
  return s.replace(/\D+/g, "");
}

export default async function ShowPublicPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const sp = await searchParams;
  // ?v=N: contratante vê só os N primeiros vídeos. Press kit e IG seguem
  // sempre. N fora do range razoável é ignorado (mostra tudo).
  const limitRaw = Number.parseInt(sp.v ?? "", 10);
  const videoLimit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50
      ? limitRaw
      : null;

  // Visitante = qualquer um não-logado. Pré-visualização de admin/músico
  // logado NÃO conta no tracking.
  const me = await getCurrentUser();
  if (!me) {
    const h = await headers();
    const ip = ipFromHeaders(h);
    const ua = h.get("user-agent") ?? "";
    logSiteVisit(ip, ua).catch(() => {});
  }

  // Material: press kit + vídeos + instagram.
  // Ordena por tipo, ordem (campo manual, default 0) e criação.
  const items = await db
    .select()
    .from(promoItems)
    .where(inArray(promoItems.tipo, ["presskit", "video", "instagram"]))
    .orderBy(
      asc(promoItems.tipo),
      asc(promoItems.ordem),
      asc(promoItems.createdAt)
    );

  const presskit = items.find((i) => i.tipo === "presskit") ?? null;
  const allVideos = items.filter((i) => i.tipo === "video");
  const videos =
    videoLimit !== null ? allVideos.slice(0, videoLimit) : allVideos;
  const instagram = items.find((i) => i.tipo === "instagram") ?? null;
  const igHandle = instagram ? extractIgHandle(instagram.url) : "";

  // Contato WhatsApp: primeiro admin com telefone cadastrado.
  const [contact] = await db
    .select({
      telefone: users.telefone,
      apelido: users.apelido,
      nome: users.nome,
    })
    .from(users)
    .where(and(eq(users.role, "admin"), isNotNull(users.telefone)))
    .limit(1);

  const waNumber = onlyDigits(contact?.telefone ?? "");
  const waName = contact?.apelido || contact?.nome || "a banda";
  const waMsg = encodeURIComponent(
    `Oi! Vi o material da The Rock e quero conversar sobre um show. (${waName})`
  );
  const waUrl = waNumber
    ? `https://wa.me/55${waNumber}?text=${waMsg}`
    : `https://wa.me/?text=${waMsg}`;

  const logoUrl = await getLogoUrl();

  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Header com logo */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-5 flex items-center gap-3">
          <div className="size-12 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A] flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="The Rock"
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="font-bold tracking-wide">The Rock</p>
            <p className="text-xs text-muted-foreground">
              Material da banda · BH
            </p>
          </div>
          {me && (
            <Link
              href={me.role === "admin" ? "/contratantes" : "/"}
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
              title="Você está vendo essa página como contratante. Esse botão só aparece pra você (admin/músico)."
            >
              <ChevronLeft className="size-4" />
              Sair da prévia
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-8">
        {/* PRESS KIT */}
        <section>
          {presskit ? (
            <PressKitSection src={`/show/presskit`} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Press kit ainda não disponível.
            </p>
          )}
        </section>

        {/* VÍDEOS */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🎬 Vídeos
          </h2>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum vídeo disponível ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg overflow-hidden border border-border bg-card"
                >
                  <VideoPlayer url={v.url} title={v.titulo} cover={v.cover} />
                  <div className="px-4 py-3">
                    <p className="font-medium truncate">{v.titulo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* INSTAGRAM */}
        {instagram && (
          <section>
            <a
              href={instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden relative group focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Abrir o Instagram da banda"
            >
              <div className="bg-linear-to-tr from-amber-400 via-pink-600 to-purple-600 p-5 sm:p-6 flex items-center gap-4 text-white">
                <div className="size-14 sm:size-16 rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur flex items-center justify-center shrink-0 group-hover:bg-white/25 transition-colors">
                  <InstagramIcon className="size-7 sm:size-8" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-white/80">
                    Instagram
                  </p>
                  <p className="text-lg sm:text-xl font-bold truncate">
                    {igHandle ? `@${igHandle}` : "Siga a banda"}
                  </p>
                  <p className="text-sm text-white/85">
                    Bastidores, shows e novidades em primeira mão.
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white text-purple-700 font-semibold px-4 py-2 text-sm shadow group-hover:scale-[1.03] transition-transform shrink-0">
                  Ver no Instagram
                  <ExternalLink className="size-3.5" />
                </span>
              </div>
              <div className="sm:hidden bg-white text-purple-700 font-semibold text-sm text-center py-2.5 inline-flex w-full items-center justify-center gap-1.5">
                Ver no Instagram <ExternalLink className="size-3.5" />
              </div>
            </a>
          </section>
        )}

        {/* CTA WhatsApp */}
        <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-2">
          <p className="font-semibold">Curtiu? Bora marcar um show!</p>
          <p className="text-sm text-muted-foreground">
            Chama a gente no WhatsApp pra falar de data, valor e detalhes.
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-5 py-2.5 transition-colors"
          >
            💬 Falar com a banda
          </a>
        </section>

        <footer className="text-center text-xs text-muted-foreground py-6 space-y-1">
          <p>The Rock — BH · {new Date().getFullYear()}</p>
          <p className="opacity-70">
            Pra controle, registramos a data, hora e cidade aproximada do
            acesso. Sem dados pessoais.
          </p>
        </footer>
      </div>
    </main>
  );
}
