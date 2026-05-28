import Link from "next/link";
import { eq, asc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { InstagramIcon } from "@/components/shared/icons";
import { db } from "@/db";
import { contractorLinks, promoItems, users } from "@/db/schema";
import { getCurrentUser, getLogoUrl } from "@/lib/auth";
import { PressKitSection } from "@/components/contratantes/press-kit-section";
import { VideoPlayer } from "@/components/contratantes/video-player";
import {
  ipFromHeaders,
  logContractorLinkVisit,
} from "@/lib/visit-logger";

function extractIgHandle(url: string): string {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  if (!m) return "";
  const h = m[1].trim();
  if (["p", "reel", "reels", "explore", "tv", "stories"].includes(h.toLowerCase()))
    return "";
  return h.startsWith("@") ? h.slice(1) : h;
}

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "The Rock — Material para contratantes",
    robots: { index: false, follow: false },
  };
}

export default async function ContratantePublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [link] = await db
    .select()
    .from(contractorLinks)
    .where(eq(contractorLinks.token, token))
    .limit(1);
  if (!link) notFound();

  const now = Date.now();
  const expired = link.expiresEm.getTime() < now;
  const revoked = Boolean(link.revokedEm);

  if (expired || revoked) {
    return (
      <ExpiredPage
        title={revoked ? "Link revogado" : "Link expirado"}
        description={
          revoked
            ? "Esse link foi revogado pela banda. Entre em contato pra receber um novo."
            : "Esse link expirou. Entre em contato com a banda pra receber um novo."
        }
      />
    );
  }

  // Pra quem está logado (admin/músico) testando o link, mostra atalho de
  // voltar. Visitante externo não vê nada disso.
  const me = await getCurrentUser();
  const isCreatorOrAdmin =
    me?.role === "admin" || (me && link.createdBy === me.id);

  // Loga a visita (fire-and-forget) só quando é visitante externo —
  // pré-visualizações do admin/criador não contam.
  if (!isCreatorOrAdmin) {
    const h = await headers();
    const ip = ipFromHeaders(h);
    const ua = h.get("user-agent") ?? "";
    logContractorLinkVisit(link.id, ip, ua).catch(() => {});
  }

  // Material: press kit (1) + vídeos (todos) + instagram (1).
  const items = await db
    .select()
    .from(promoItems)
    .where(inArray(promoItems.tipo, ["presskit", "video", "instagram"]))
    .orderBy(asc(promoItems.tipo), asc(promoItems.createdAt));

  const presskit = items.find((i) => i.tipo === "presskit") ?? null;
  const videos = items.filter((i) => i.tipo === "video");
  const instagram = items.find((i) => i.tipo === "instagram") ?? null;
  const igHandle = instagram ? extractIgHandle(instagram.url) : "";

  // WhatsApp do admin que criou o link.
  const [creator] = link.createdBy
    ? await db
        .select({ telefone: users.telefone, apelido: users.apelido, nome: users.nome })
        .from(users)
        .where(eq(users.id, link.createdBy))
        .limit(1)
    : [];
  const waNumber = onlyDigits(creator?.telefone ?? "");
  const waName = creator?.apelido || creator?.nome || "a banda";
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
            <PressKitSection src={`/c/${token}/presskit`} />
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
                  <VideoPlayer
                    url={v.url}
                    title={v.titulo}
                    cover={v.cover}
                  />
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

function ExpiredPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center px-5">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </main>
  );
}

function onlyDigits(s: string): string {
  return s.replace(/\D+/g, "");
}
