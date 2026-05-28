import Link from "next/link";
import { eq, sql, asc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { contractorLinks, promoItems, users } from "@/db/schema";
import { getCurrentUser, getLogoUrl } from "@/lib/auth";
import { detectVideoEmbed } from "@/lib/video-embed";
import { PressKitSection } from "@/components/contratantes/press-kit-section";
import { VideoPlayer } from "@/components/contratantes/video-player";

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

  // Conta a visita (fire-and-forget, não bloqueia render).
  db
    .update(contractorLinks)
    .set({
      viewCount: sql`${contractorLinks.viewCount} + 1`,
      lastViewedEm: new Date(),
    })
    .where(eq(contractorLinks.id, link.id))
    .catch(() => {});

  // Material: press kit (1) + vídeos (todos).
  const items = await db
    .select()
    .from(promoItems)
    .where(inArray(promoItems.tipo, ["presskit", "video"]))
    .orderBy(asc(promoItems.tipo), asc(promoItems.createdAt));

  const presskit = items.find((i) => i.tipo === "presskit") ?? null;
  const videos = items.filter((i) => i.tipo === "video");

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
  // Pra quem tá logado (admin/músico) testando o link, mostra um atalho de
  // voltar pro app. Visitante externo não vê nada disso.
  const me = await getCurrentUser();

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
              {videos.map((v) => {
                const embed = detectVideoEmbed(v.url);
                return (
                  <div
                    key={v.id}
                    className="rounded-lg overflow-hidden border border-border bg-card"
                  >
                    {embed.kind === "embed" ? (
                      <VideoPlayer
                        url={v.url}
                        title={v.titulo}
                        cover={v.cover}
                      />
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        Vídeo externo — abra pelo link abaixo.
                      </div>
                    )}
                    <div className="px-4 py-3 flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{v.titulo}</p>
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 shrink-0"
                      >
                        Abrir
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

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

        <footer className="text-center text-xs text-muted-foreground py-6">
          The Rock — BH · {new Date().getFullYear()}
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
