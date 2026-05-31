"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download, Upload, Shuffle, Loader2, ImageIcon, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fileToDownscaledDataUrl } from "@/lib/image-resize";
import { addImagemDivulgacaoAction } from "@/app/(app)/shows/[id]/divulgacao/actions";

type Show = {
  banda: string;
  casaNome: string;
  dataLabel: string;
  inicio: string | null;
  termino: string | null;
  valorIngresso: string | null;
  linkVendas: string | null;
  logoUrl: string | null;
};

type Estilo = "festival" | "minimal" | "tarja";
type Pos = "top" | "center" | "bottom";

const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const GRADIENTES = [
  "radial-gradient(120% 90% at 50% 0%, #2a0a0a, #09090b 65%)",
  "radial-gradient(120% 90% at 50% 0%, #0a1430, #09090b 65%)",
  "linear-gradient(135deg, #18120a, #09090b 70%)",
  "linear-gradient(135deg, #1a0a1e, #09090b 70%)",
];

export function FlyerStudio({
  show,
  galeria,
}: {
  show: Show;
  galeria: { id: string; url: string }[];
}) {
  const [imgs, setImgs] = useState(galeria);
  const [bg, setBg] = useState<string | null>(galeria[0]?.url ?? null);
  const [grad, setGrad] = useState(GRADIENTES[0]);
  const [aspect, setAspect] = useState<"9:16" | "1:1">("9:16");
  const [estilo, setEstilo] = useState<Estilo>("festival");
  const [pos, setPos] = useState<Pos>("bottom");
  const [ref0, setRef0] = useState<string | null>(null); // referência de estilo (não vai no flyer)

  // Campos editáveis
  const [headline, setHeadline] = useState("AO VIVO");
  const [banda, setBanda] = useState(show.banda);
  const [casa, setCasa] = useState(show.casaNome);
  const [data, setData] = useState(show.dataLabel);
  const [ingresso, setIngresso] = useState(show.valorIngresso ?? "");
  const [link, setLink] = useState(show.linkVendas ?? "");

  const [qr, setQr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = link.trim();
    if (!l) return setQr(null);
    import("qrcode").then((Q) => Q.toDataURL(l, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(null)));
  }, [link]);

  function onUpload(files: FileList, asBg = true) {
    const arr = Array.from(files);
    start(async () => {
      let first = true;
      for (const f of arr) {
        const url = await fileToDownscaledDataUrl(f, 1600, 0.82);
        setImgs((p) => [{ id: `local-${Date.now()}-${Math.round(performance.now())}`, url }, ...p]);
        if (first && asBg) { setBg(url); first = false; }
        await addImagemDivulgacaoAction(url);
      }
    });
  }

  async function baixar() {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(ref.current, {
        useCORS: true,
        backgroundColor: "#09090b",
        scale: 1080 / ref.current.offsetWidth,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `flyer-${aspect === "9:16" ? "stories" : "feed"}.png`;
      a.click();
    } catch {
      toast.error("Falha ao exportar. Se usou link de imagem externo, envie a foto (Enviar foto).");
    } finally {
      setDownloading(false);
    }
  }

  const W = 300;
  const H = aspect === "9:16" ? Math.round((W * 16) / 9) : W;
  const justify = pos === "top" ? "justify-start" : pos === "center" ? "justify-center" : "justify-end";

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* PREVIEW */}
      <div className="flex flex-col items-center gap-3">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-xl ring-1 ring-zinc-800"
          style={{ width: W, height: H, background: bg ? "#000" : grad }}
        >
          {bg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-cover" />
          )}
          {/* legibilidade */}
          <div
            className="absolute inset-0"
            style={{
              background:
                pos === "top"
                  ? "linear-gradient(to bottom, rgba(9,9,11,.92), rgba(9,9,11,.25) 45%, transparent 70%)"
                  : pos === "center"
                    ? "radial-gradient(120% 70% at 50% 50%, rgba(9,9,11,.85), rgba(9,9,11,.35) 70%, transparent)"
                    : "linear-gradient(to top, rgba(9,9,11,.94), rgba(9,9,11,.4) 45%, transparent 72%)",
            }}
          />

          {/* logo no topo */}
          {show.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={show.logoUrl}
              alt=""
              crossOrigin="anonymous"
              className={cn(
                "absolute size-9 rounded-md object-contain ring-1 ring-white/15",
                pos === "top" ? "right-3 top-3" : "left-3 top-3"
              )}
            />
          )}

          {/* CONTEÚDO */}
          <div className={cn("absolute inset-0 flex flex-col p-5", justify)}>
            <Conteudo
              estilo={estilo}
              headline={headline}
              banda={banda}
              casa={casa}
              data={data}
              inicio={show.inicio}
              ingresso={ingresso}
              qr={qr}
            />
          </div>
        </div>

        <Button onClick={baixar} disabled={downloading} className="w-full bg-red-600 hover:bg-red-700">
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar {aspect === "9:16" ? "Stories (9:16)" : "Feed (1:1)"}
        </Button>
      </div>

      {/* CONTROLES */}
      <div className="space-y-4">
        {/* Estilo */}
        <Bloco titulo="Estilo">
          <Chips
            value={estilo}
            onChange={(v) => setEstilo(v as Estilo)}
            options={[
              ["festival", "Festival"],
              ["minimal", "Minimalista"],
              ["tarja", "Tarja"],
            ]}
          />
        </Bloco>

        {/* Formato + posição */}
        <Bloco titulo="Formato e posição">
          <div className="flex flex-wrap gap-2">
            <Chips value={aspect} onChange={(v) => setAspect(v as "9:16" | "1:1")} options={[["9:16", "Stories"], ["1:1", "Feed"]]} />
            <Chips value={pos} onChange={(v) => setPos(v as Pos)} options={[["top", "Topo"], ["center", "Centro"], ["bottom", "Rodapé"]]} />
          </div>
        </Bloco>

        {/* Textos */}
        <Bloco titulo="Textos">
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo label="Chamada" value={headline} onChange={setHeadline} />
            <Campo label="Banda" value={banda} onChange={setBanda} />
            <Campo label="Casa / local" value={casa} onChange={setCasa} />
            <Campo label="Data" value={data} onChange={setData} />
            <Campo label="Ingresso" value={ingresso} onChange={setIngresso} placeholder="R$ 20 / Gratuito" />
            <Campo label="Link de venda (vira QR)" value={link} onChange={setLink} placeholder="https://…" />
          </div>
        </Bloco>

        {/* Fundo */}
        <Bloco titulo="Fundo">
          <div className="mb-2 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Enviar foto
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && onUpload(e.target.files)} />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800" title="Use o cartaz/arte da casa como fundo do flyer">
              <Building2 className="size-4" /> Template da casa
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files)} />
            </label>
            {imgs.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setBg(imgs[Math.floor(Math.random() * imgs.length)].url)}>
                <Shuffle className="size-4" /> Sortear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBg(null)} className={cn("size-11 rounded-md border", !bg ? "border-primary" : "border-zinc-700")} style={{ background: grad }} title="Sem foto" />
            {GRADIENTES.map((g) => (
              <button key={g} onClick={() => { setGrad(g); setBg(null); }} className="size-11 rounded-md border border-zinc-700" style={{ background: g }} />
            ))}
          </div>
          {imgs.length > 0 && (
            <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-7">
              {imgs.map((im) => (
                <button key={im.id} onClick={() => setBg(im.url)} className={cn("aspect-square overflow-hidden rounded-md border", bg === im.url ? "border-primary ring-1 ring-primary" : "border-zinc-700")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </Bloco>

        {/* Referência de estilo (opcional, não entra no flyer) */}
        <Bloco titulo="Referência de estilo (opcional)">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
              <ImageIcon className="size-4" /> Enviar exemplo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRef0(await fileToDownscaledDataUrl(f, 900, 0.7)); }}
              />
            </label>
            {ref0 && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref0} alt="referência" className="h-16 w-12 rounded object-cover ring-1 ring-zinc-700" />
                <button onClick={() => setRef0(null)} className="text-xs text-zinc-500 hover:text-foreground">remover</button>
              </>
            )}
            <span className="text-xs text-zinc-500">Pra te inspirar ao montar — não vai no flyer.</span>
          </div>
        </Bloco>
      </div>
    </div>
  );
}

function Conteudo({
  estilo, headline, banda, casa, data, inicio, ingresso, qr,
}: {
  estilo: Estilo; headline: string; banda: string; casa: string; data: string; inicio: string | null; ingresso: string; qr: string | null;
}) {
  const QR = qr ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={qr} alt="QR" className="size-14 shrink-0 rounded bg-white p-0.5" />
  ) : null;

  if (estilo === "minimal") {
    return (
      <div className="w-full">
        {headline && <p className="text-[10px] uppercase tracking-[0.35em] text-amber-400">{headline}</p>}
        <p className="mt-1 text-3xl font-bold leading-none text-zinc-100" style={{ fontFamily: DISPLAY, letterSpacing: ".02em" }}>{banda}</p>
        <div className="mt-3 h-px w-12 bg-red-600" />
        <p className="mt-3 text-sm font-medium text-zinc-100">{casa}</p>
        <p className="text-xs text-zinc-400">{data}{inicio ? ` · ${inicio}` : ""}{ingresso ? ` · ${ingresso}` : ""}</p>
        {QR && <div className="mt-3">{QR}</div>}
      </div>
    );
  }

  if (estilo === "tarja") {
    return (
      <div className="w-full rounded-lg border border-red-600 bg-zinc-950/85 p-3 backdrop-blur-sm">
        {headline && <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400">{headline}</p>}
        <p className="text-2xl font-black leading-none text-zinc-100" style={{ fontFamily: DISPLAY }}>{banda}</p>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div className="text-[11px] leading-tight text-zinc-200">
            <p className="font-semibold">{casa}</p>
            <p className="text-zinc-400">{data}{inicio ? ` · ${inicio}` : ""}</p>
            {ingresso && <p className="text-amber-400">Ingresso: {ingresso}</p>}
          </div>
          {QR}
        </div>
      </div>
    );
  }

  // festival (default)
  return (
    <div className="w-full">
      {headline && (
        <span className="inline-block bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white">{headline}</span>
      )}
      <p className="mt-2 text-5xl font-extrabold uppercase leading-[0.85] text-zinc-100" style={{ fontFamily: DISPLAY, letterSpacing: ".01em" }}>{banda}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="leading-tight">
          <p className="text-lg font-bold text-amber-400" style={{ fontFamily: DISPLAY }}>{data}{inicio ? ` · ${inicio}` : ""}</p>
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-100">{casa}</p>
          {ingresso && (
            <span className="mt-1 inline-block rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-zinc-950">{ingresso}</span>
          )}
        </div>
        {QR}
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="border-zinc-800 bg-[#18181b]">
      <CardContent className="py-4 space-y-2">
        <p className="text-xs uppercase tracking-wider text-zinc-400">{titulo}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium",
            value === v ? "border-primary bg-primary/20 text-primary" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Campo({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-zinc-400">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 bg-[#0f0f11]" />
    </div>
  );
}
