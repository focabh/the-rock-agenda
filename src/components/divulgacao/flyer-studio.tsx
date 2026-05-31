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
type Efeito = "nenhum" | "sombra" | "contorno" | "neon";

const FONTES: Record<string, { label: string; family: string }> = {
  anton: { label: "Impacto", family: "'Anton', system-ui, sans-serif" },
  poppins: { label: "Moderna", family: "'Poppins', system-ui, sans-serif" },
  barlow: { label: "Condensada", family: "'Barlow Condensed', system-ui, sans-serif" },
  serif: { label: "Elegante", family: "'Playfair Display', Georgia, serif" },
};

const ACCENTS = ["#f59e0b", "#ef4444", "#fafafa", "#22d3ee", "#f472b6", "#a3e635"];

const GRADIENTES = [
  "radial-gradient(120% 90% at 50% 0%, #2a0a0a, #09090b 65%)",
  "radial-gradient(120% 90% at 50% 0%, #0a1430, #09090b 65%)",
  "linear-gradient(135deg, #18120a, #09090b 70%)",
  "linear-gradient(135deg, #1a0a1e, #09090b 70%)",
];

function fx(efeito: Efeito, accent: string): React.CSSProperties {
  switch (efeito) {
    case "sombra":
      return { textShadow: "0 2px 12px rgba(0,0,0,.7)" };
    case "contorno":
      return { textShadow: "1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,0 2px 6px rgba(0,0,0,.5)" };
    case "neon":
      return { textShadow: `0 0 8px ${accent}aa, 0 0 22px ${accent}88, 0 2px 8px rgba(0,0,0,.5)` };
    default:
      return {};
  }
}
const pillText = (accent: string) => (accent === "#ef4444" ? "#fff" : "#09090b");

export function FlyerStudio({ show, galeria }: { show: Show; galeria: { id: string; url: string }[] }) {
  const [imgs, setImgs] = useState(galeria);
  const [bg, setBg] = useState<string | null>(galeria[0]?.url ?? null);
  const [grad, setGrad] = useState(GRADIENTES[0]);
  const [aspect, setAspect] = useState<"9:16" | "1:1">("9:16");
  const [estilo, setEstilo] = useState<Estilo>("festival");
  const [pos, setPos] = useState<Pos>("bottom");
  const [fonte, setFonte] = useState("anton");
  const [efeito, setEfeito] = useState<Efeito>("sombra");
  const [accent, setAccent] = useState("#f59e0b");
  const [scrim, setScrim] = useState(62);
  const [ref0, setRef0] = useState<string | null>(null);

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

  function onUpload(files: FileList) {
    const arr = Array.from(files);
    start(async () => {
      let first = true;
      for (const f of arr) {
        const url = await fileToDownscaledDataUrl(f, 1600, 0.82);
        setImgs((p) => [{ id: `local-${Date.now()}-${Math.round(performance.now())}`, url }, ...p]);
        if (first) { setBg(url); first = false; }
        await addImagemDivulgacaoAction(url);
      }
    });
  }

  async function baixar() {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(ref.current, { useCORS: true, backgroundColor: "#09090b", scale: 1080 / ref.current.offsetWidth });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `flyer-${aspect === "9:16" ? "stories" : "feed"}.png`;
      a.click();
    } catch {
      toast.error("Falha ao exportar. Se usou link de imagem externo, envie a foto.");
    } finally {
      setDownloading(false);
    }
  }

  const W = 300;
  const H = aspect === "9:16" ? Math.round((W * 16) / 9) : W;
  const justify = pos === "top" ? "justify-start" : pos === "center" ? "justify-center" : "justify-end";
  const a = scrim / 100;
  const scrimBg =
    pos === "top"
      ? `linear-gradient(to bottom, rgba(9,9,11,${a + 0.25}), rgba(9,9,11,${a * 0.4}) 45%, transparent 72%)`
      : pos === "center"
        ? `radial-gradient(130% 75% at 50% 50%, rgba(9,9,11,${a + 0.2}), rgba(9,9,11,${a * 0.5}) 65%, transparent)`
        : `linear-gradient(to top, rgba(9,9,11,${a + 0.3}), rgba(9,9,11,${a * 0.45}) 45%, transparent 74%)`;

  const fam = FONTES[fonte].family;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col items-center gap-3">
        <div ref={ref} className="relative overflow-hidden rounded-xl ring-1 ring-zinc-800" style={{ width: W, height: H, background: bg ? "#000" : grad }}>
          {bg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: scrimBg }} />
          <div className={cn("absolute inset-0 flex flex-col p-5", justify)}>
            <Conteudo estilo={estilo} fam={fam} efeito={efeito} accent={accent} headline={headline} banda={banda} casa={casa} data={data} inicio={show.inicio} ingresso={ingresso} qr={qr} />
          </div>
        </div>
        <Button onClick={baixar} disabled={downloading} className="w-full bg-red-600 hover:bg-red-700">
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar {aspect === "9:16" ? "Stories (9:16)" : "Feed (1:1)"}
        </Button>
      </div>

      <div className="space-y-4">
        <Bloco titulo="Estilo">
          <Chips value={estilo} onChange={(v) => setEstilo(v as Estilo)} options={[["festival", "Festival"], ["minimal", "Minimalista"], ["tarja", "Tarja"]]} />
        </Bloco>
        <Bloco titulo="Fonte">
          <Chips value={fonte} onChange={setFonte} options={Object.entries(FONTES).map(([k, v]) => [k, v.label] as [string, string])} />
        </Bloco>
        <Bloco titulo="Efeito do texto">
          <Chips value={efeito} onChange={(v) => setEfeito(v as Efeito)} options={[["nenhum", "Nenhum"], ["sombra", "Sombra"], ["contorno", "Contorno"], ["neon", "Neon"]]} />
        </Bloco>
        <Bloco titulo="Cor de destaque">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setAccent(c)} className={cn("size-8 rounded-full ring-2", accent === c ? "ring-white" : "ring-transparent")} style={{ background: c }} />
            ))}
          </div>
        </Bloco>
        <Bloco titulo="Formato e posição">
          <div className="flex flex-wrap gap-2">
            <Chips value={aspect} onChange={(v) => setAspect(v as "9:16" | "1:1")} options={[["9:16", "Stories"], ["1:1", "Feed"]]} />
            <Chips value={pos} onChange={(v) => setPos(v as Pos)} options={[["top", "Topo"], ["center", "Centro"], ["bottom", "Rodapé"]]} />
          </div>
        </Bloco>
        <Bloco titulo={`Transparência do fundo · ${scrim}%`}>
          <input type="range" min={0} max={95} value={scrim} onChange={(e) => setScrim(Number(e.target.value))} className="w-full accent-red-600" />
          <p className="text-[11px] text-zinc-500">Menos = a foto aparece mais. Mais = escurece pra leitura.</p>
        </Bloco>
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
        <Bloco titulo="Fundo">
          <div className="mb-2 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Enviar foto
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && onUpload(e.target.files)} />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800" title="Use o cartaz/arte da casa como fundo">
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
        <Bloco titulo="Referência de estilo (opcional)">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
              <ImageIcon className="size-4" /> Enviar exemplo
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRef0(await fileToDownscaledDataUrl(f, 900, 0.7)); }} />
            </label>
            {ref0 && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref0} alt="referência" className="h-16 w-12 rounded object-cover ring-1 ring-zinc-700" />
                <button onClick={() => setRef0(null)} className="text-xs text-zinc-500 hover:text-foreground">remover</button>
              </>
            )}
            <span className="text-xs text-zinc-500">Pra te inspirar — não vai no flyer.</span>
          </div>
        </Bloco>
      </div>
    </div>
  );
}

function Conteudo({
  estilo, fam, efeito, accent, headline, banda, casa, data, inicio, ingresso, qr,
}: {
  estilo: Estilo; fam: string; efeito: Efeito; accent: string; headline: string; banda: string; casa: string; data: string; inicio: string | null; ingresso: string; qr: string | null;
}) {
  const titleFx = fx(efeito, accent);
  const QR = qr ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={qr} alt="QR" className="size-14 shrink-0 rounded bg-white p-0.5" />
  ) : null;

  if (estilo === "minimal") {
    return (
      <div className="w-full">
        {headline && <p className="text-[10px] uppercase tracking-[0.35em]" style={{ color: accent }}>{headline}</p>}
        <p className="mt-1 text-3xl font-bold uppercase leading-none text-zinc-50" style={{ fontFamily: fam, ...titleFx }}>{banda}</p>
        <div className="mt-3 h-px w-12" style={{ background: accent }} />
        <p className="mt-3 text-sm font-medium text-zinc-100" style={{ textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{casa}</p>
        <p className="text-xs text-zinc-300" style={{ textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{data}{inicio ? ` · ${inicio}` : ""}{ingresso ? ` · ${ingresso}` : ""}</p>
        {QR && <div className="mt-3">{QR}</div>}
      </div>
    );
  }

  if (estilo === "tarja") {
    return (
      <div className="w-full rounded-lg bg-zinc-950/80 p-3 backdrop-blur-sm" style={{ border: `1px solid ${accent}` }}>
        {headline && <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: accent }}>{headline}</p>}
        <p className="text-2xl font-black uppercase leading-none text-zinc-50" style={{ fontFamily: fam, ...titleFx }}>{banda}</p>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div className="text-[11px] leading-tight text-zinc-200">
            <p className="font-semibold">{casa}</p>
            <p className="text-zinc-400">{data}{inicio ? ` · ${inicio}` : ""}</p>
            {ingresso && <p style={{ color: accent }}>Ingresso: {ingresso}</p>}
          </div>
          {QR}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {headline && (
        <span className="inline-block px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ background: accent, color: pillText(accent) }}>{headline}</span>
      )}
      <p className="mt-2 text-5xl font-black uppercase leading-[0.85] text-zinc-50" style={{ fontFamily: fam, ...titleFx }}>{banda}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="leading-tight">
          <p className="text-lg font-bold" style={{ fontFamily: fam, color: accent, ...titleFx }}>{data}{inicio ? ` · ${inicio}` : ""}</p>
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-100" style={{ textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{casa}</p>
          {ingresso && (
            <span className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: accent, color: pillText(accent) }}>{ingresso}</span>
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
        <button key={v} onClick={() => onChange(v)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", value === v ? "border-primary bg-primary/20 text-primary" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}>{l}</button>
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
