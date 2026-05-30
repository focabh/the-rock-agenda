import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Pencil,
  ChevronLeft,
  Phone,
  MapPin,
  Send,
  CalendarCheck,
  Megaphone,
  Heart,
} from "lucide-react";
import { InstagramIcon } from "@/components/shared/icons";
import { db } from "@/db";
import { venues, shows, venueContacts, promoItems } from "@/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VenueActions } from "@/components/casas/venue-actions";
import { VenueProfile } from "@/components/casas/venue-profile";
import { parseTags } from "@/lib/venue-tags";
import {
  formatDataBR,
  formatRelativeBR,
  toBRDatetimeLocal,
} from "@/lib/formatters";
import { TIPO_LABEL } from "@/lib/venue-messages";

export default async function CasaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const admin = isAdmin(user);

  const [casa] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
  if (!casa) notFound();

  const [casaShows, contatos, obrigatorios] = await Promise.all([
    db.select().from(shows).where(eq(shows.casaId, id)).orderBy(desc(shows.data)),
    db
      .select()
      .from(venueContacts)
      .where(eq(venueContacts.venueId, id))
      .orderBy(desc(venueContacts.createdAt))
      .limit(20),
    db.select().from(promoItems).where(eq(promoItems.obrigatorio, true)),
  ]);

  // Links de material que vão SEMPRE na divulgação: itens "enviar sempre" +
  // a página pública. Press kit usa a rota que serve o PDF; uploads (data:)
  // não são compartilháveis, então só entram links http.
  const materialLinks: string[] = [];
  for (const p of obrigatorios) {
    if (p.tipo === "presskit") materialLinks.push("/show/presskit");
    else if (/^https?:\/\//.test(p.url)) materialLinks.push(p.url);
  }
  materialLinks.push("/show");
  const materialLinksUnicos = [...new Set(materialLinks)];

  const now = new Date();
  const pastShows = casaShows.filter((s) => s.data.getTime() <= now.getTime());
  const lastShow = pastShows[0]?.data ?? null; // ordenado desc
  const manualApr = casa.ultimaApresentacaoManual ?? null;
  const ultimaApresentacao =
    [lastShow, manualApr]
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const jaTocouEff = casa.jaTocou || pastShows.length > 0;

  const materialDate = casa.materialEnviadoEm
    ? toBRDatetimeLocal(casa.materialEnviadoEm).slice(0, 10)
    : "";
  const aprDate = manualApr ? toBRDatetimeLocal(manualApr).slice(0, 10) : "";

  return (
    <div>
      <PageHeader
        title={casa.nome}
        description={
          [casa.bairro, casa.cidade, casa.estado].filter(Boolean).join(" · ") ||
          "Casa"
        }
        actions={
          <div className="flex items-center gap-2">
            {admin && (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/casas/${id}/editar`} />}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            <Button variant="outline" size="sm" render={<Link href="/casas" />}>
              <ChevronLeft className="size-4" />
              Voltar
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Status */}
        <div className="flex flex-wrap gap-2">
          {casa.naoContatar ? (
            <Badge tone="red">Não contatar</Badge>
          ) : (
            <Badge tone="muted">Ativa para contato</Badge>
          )}
          {casa.querTocar && <Badge tone="primary">Gostaria de tocar</Badge>}
          {jaTocouEff && <Badge tone="emerald">Já tocou aqui</Badge>}
        </div>

        {/* Infos */}
        <Card className="p-4 space-y-2 text-sm">
          {casa.contatoPrincipal && (
            <p>
              <span className="text-muted-foreground">Contato:</span>{" "}
              {casa.contatoPrincipal}
            </p>
          )}
          {casa.telefone && (
            <p className="flex items-center gap-1.5">
              <Phone className="size-3.5 text-muted-foreground" />
              {casa.telefone}
            </p>
          )}
          {casa.endereco && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" />
              {casa.endereco}
            </p>
          )}
          {casa.instagram && (
            <p className="flex items-center gap-1.5">
              <InstagramIcon className="size-3.5 text-muted-foreground" />
              <a
                href={
                  casa.instagram.startsWith("http")
                    ? casa.instagram
                    : `https://instagram.com/${casa.instagram.replace(/^@/, "")}`
                }
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {casa.instagram}
              </a>
            </p>
          )}
          {casa.observacoes && (
            <p className="text-muted-foreground whitespace-pre-wrap pt-1">
              {casa.observacoes}
            </p>
          )}
        </Card>

        {/* Perfil & características */}
        <VenueProfile
          venueId={id}
          initialTags={parseTags(casa.caracteristicas)}
          initialPerfil={casa.perfilPublico ?? ""}
          admin={admin}
        />

        {/* Resumo automático */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            icon={<Megaphone className="size-4" />}
            label="Material"
            value={
              casa.materialEnviadoEm
                ? `enviado ${formatDataBR(casa.materialEnviadoEm)}`
                : "não enviado"
            }
          />
          <Stat
            icon={<Send className="size-4" />}
            label="Último contato"
            value={
              casa.ultimoContatoEm
                ? formatRelativeBR(casa.ultimoContatoEm, now)
                : "nenhum"
            }
          />
          <Stat
            icon={<CalendarCheck className="size-4" />}
            label="Última apresentação"
            value={ultimaApresentacao ? formatDataBR(ultimaApresentacao) : "—"}
          />
        </div>

        {/* Ações */}
        <VenueActions
          venueId={id}
          telefone={casa.telefone}
          rel={{
            querTocar: casa.querTocar,
            jaTocou: casa.jaTocou,
            naoContatar: casa.naoContatar,
          }}
          materialLinks={materialLinksUnicos}
          materialDate={materialDate}
          apresentacaoDate={aprDate}
          admin={admin}
        />

        {/* Histórico de contatos */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Heart className="size-3.5" />
            Histórico de contatos
          </h2>
          {contatos.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              Nenhum contato registrado ainda. Use os botões de mensagem acima.
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-border">
                {contatos.map((c) => (
                  <li key={c.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {TIPO_LABEL[c.tipo]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeBR(c.createdAt, now)}
                      </span>
                    </div>
                    {c.mensagem && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {c.mensagem}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "emerald" | "red" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary/20 text-primary ring-primary/40"
      : tone === "emerald"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : tone === "red"
          ? "bg-red-500/15 text-red-300 ring-red-500/30"
          : "ring-border text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </Card>
  );
}
