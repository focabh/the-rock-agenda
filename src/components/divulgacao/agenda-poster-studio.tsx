"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Upload, Shuffle, Loader2, Plus, X, ImageIcon, Wand2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fileToDownscaledDataUrl } from "@/lib/image-resize";
import { addImagemDivulgacaoAction } from "@/app/(app)/shows/[id]/divulgacao/actions";
import { gerarImagemIAAction } from "@/app/(app)/shows/[id]/divulgacao/ia-actions";

export type PosterShow = {
  ts: number;
  shortData: string;
  dia: string;
  hora: string;
  casa: string;
  cidade: string | null;
};

type Efeito = "nenhum" | "sombra" | "contorno" | "neon" | "3d" | "longa" | "brilho" | "duplo";
type Banda = { nome: string; hora: string };
type Escopo = "imagem" | "texto";
type Modelo = { fonte: string; efeito: Efeito; accent: string; grad: string };

const EFEITOS: [Efeito, string][] = [
  ["nenhum", "Nenhum"],
  ["sombra", "Sombra"],
  ["contorno", "Contorno"],
  ["neon", "Neon"],
  ["3d", "3D Retrô"],
  ["longa", "Sombra longa"],
  ["brilho", "Brilho"],
  ["duplo", "Halo duplo"],
];

const FONTES: Record<string, { label: string; family: string }> = {
  anton: { label: "Impacto", family: "'Anton', system-ui, sans-serif" },
  bebas: { label: "Alta", family: "'Bebas Neue', system-ui, sans-serif" },
  archivo: { label: "Bloco", family: "'Archivo Black', system-ui, sans-serif" },
  oswald: { label: "Estádio", family: "'Oswald', system-ui, sans-serif" },
  barlow: { label: "Condensada", family: "'Barlow Condensed', system-ui, sans-serif" },
  poppins: { label: "Moderna", family: "'Poppins', system-ui, sans-serif" },
  montserrat: { label: "Geométrica", family: "'Montserrat', system-ui, sans-serif" },
  righteous: { label: "Retrô", family: "'Righteous', system-ui, sans-serif" },
  serif: { label: "Elegante", family: "'Playfair Display', Georgia, serif" },
  abril: { label: "Glamour", family: "'Abril Fatface', Georgia, serif" },
  pacifico: { label: "Manuscrita", family: "'Pacifico', cursive" },
  marker: { label: "Marcador", family: "'Permanent Marker', cursive" },
};

const ACCENTS = ["#f59e0b", "#ef4444", "#fafafa", "#22d3ee", "#f472b6", "#a3e635"];

const CUSTO_IA_IMG = 0.2; // R$ por imagem (estimativa, teto conservador)
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PERIODOS: { key: string; label: string; dias: number }[] = [
  { key: "semanal", label: "Semana", dias: 7 },
  { key: "quinzenal", label: "Quinzena", dias: 15 },
  { key: "mensal", label: "Mês", dias: 30 },
  { key: "2meses", label: "2 meses", dias: 60 },
  { key: "3meses", label: "3 meses", dias: 90 },
];

const GRADIENTES = [
  "radial-gradient(120% 90% at 50% 0%, #2a0a0a, #09090b 65%)",
  "radial-gradient(120% 90% at 50% 0%, #0a1430, #09090b 65%)",
  "linear-gradient(135deg, #18120a, #09090b 70%)",
  "linear-gradient(135deg, #1a0a1e, #09090b 70%)",
];

async function garantirFonte(familyCss: string) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const fam = familyCss.split(",")[0].trim();
  try {
    await Promise.all([document.fonts.load(`700 48px ${fam}`), document.fonts.load(`400 48px ${fam}`)]);
    await document.fonts.ready;
  } catch {
    /* ignora */
  }
}

async function extrairPaleta(dataUrl: string): Promise<{ accent: string; grad: string }> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const w = 48;
  const h = Math.max(1, Math.round((48 * img.height) / img.width));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return { accent: "#f59e0b", grad: GRADIENTES[0] };
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const buckets = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>();
  let darkR = 0, darkG = 0, darkB = 0, darkN = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = (max + min) / 2;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (lum < 60) { darkR += r; darkG += g; darkB += b; darkN++; }
    if (lum < 35 || lum > 225 || sat < 0.25) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, sat: 0 };
    cur.r += r; cur.g += g; cur.b += b; cur.n++; cur.sat = sat;
    buckets.set(key, cur);
  }
  let best: { r: number; g: number; b: number; n: number; sat: number } | null = null;
  for (const v of buckets.values()) {
    const score = v.n * (0.5 + v.sat);
    const bestScore = best ? best.n * (0.5 + best.sat) : -1;
    if (score > bestScore) best = v;
  }
  const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
  const accent = best ? hex(best.r / best.n, best.g / best.n, best.b / best.n) : "#f59e0b";
  const dr = darkN ? darkR / darkN : 26, dg = darkN ? darkG / darkN : 10, db = darkN ? darkB / darkN : 10;
  const grad = `radial-gradient(120% 90% at 50% 0%, ${hex(dr * 1.4, dg * 1.4, db * 1.4)}, #09090b 68%)`;
  return { accent, grad };
}

function fx(efeito: Efeito, accent: string): React.CSSProperties {
  switch (efeito) {
    case "sombra":
      return { textShadow: "0 2px 12px rgba(0,0,0,.7)" };
    case "contorno":
      return { textShadow: "1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,0 2px 6px rgba(0,0,0,.5)" };
    case "neon":
      return { textShadow: `0 0 8px ${accent}aa, 0 0 22px ${accent}88, 0 2px 8px rgba(0,0,0,.5)` };
    case "3d":
      return { textShadow: `2px 2px 0 ${accent}, 4px 4px 0 rgba(0,0,0,.55)` };
    case "longa":
      return { textShadow: "3px 3px 0 rgba(0,0,0,.5),6px 6px 0 rgba(0,0,0,.32),9px 9px 0 rgba(0,0,0,.18),12px 12px 0 rgba(0,0,0,.08)" };
    case "brilho":
      return { textShadow: `0 0 10px #fff, 0 0 24px ${accent}, 0 0 40px ${accent}` };
    case "duplo":
      return { textShadow: `-1px -1px 0 #000,1px 1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000, 0 0 10px ${accent}` };
    default:
      return {};
  }
}

export function AgendaPosterStudio({
  banda,
  shows,
  galeria,
}: {
  banda: string;
  shows: PosterShow[];
  galeria: { id: string; url: string }[];
}) {
  const [periodo, setPeriodo] = useState("mensal");
  const [imgs, setImgs] = useState(galeria);
  const [bg, setBg] = useState<string | null>(null);
  const [grad, setGrad] = useState(GRADIENTES[0]);
  const [aspect, setAspect] = useState<"9:16" | "1:1">("9:16");
  const [fonte, setFonte] = useState("anton");
  const [efeito, setEfeito] = useState<Efeito>("sombra");
  const [accent, setAccent] = useState("#f59e0b");
  const [scrim, setScrim] = useState(78);
  const [escalaTitulo, setEscalaTitulo] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [pending, start] = useTransition();
  const [ref0, setRef0] = useState<string | null>(null);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [escopo, setEscopo] = useState<Escopo>("imagem");
  const [iaImgs, setIaImgs] = useState<string[]>([]);
  const [iaLoading, setIaLoading] = useState(false);

  // Festival / line-up de um único evento
  const [festival, setFestival] = useState(false);
  const [evento, setEvento] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [lineup, setLineup] = useState<Banda[]>([{ nome: banda, hora: "" }]);

  const dias = PERIODOS.find((p) => p.key === periodo)?.dias ?? 30;
  const filtrados = useMemo(() => {
    const limite = Date.now() + dias * 86400_000;
    return shows.filter((s) => s.ts <= limite).slice(0, 12);
  }, [shows, dias]);

  function onUpload(files: FileList) {
    const arr = Array.from(files);
    start(async () => {
      let primeira = true;
      for (const file of arr) {
        const url = await fileToDownscaledDataUrl(file);
        setImgs((p) => [{ id: `local-${Date.now()}-${Math.round(performance.now())}`, url }, ...p]);
        if (primeira) { setBg(url); primeira = false; }
        await addImagemDivulgacaoAction(url);
      }
      if (arr.length > 1) toast.success(`${arr.length} fotos adicionadas.`);
    });
  }

  async function gerarModelos() {
    if (!ref0) return toast.error("Envie um exemplo de estilo primeiro.");
    try {
      const { accent: ac, grad: gr } = await extrairPaleta(ref0);
      setModelos([
        { fonte: "anton", efeito: "neon", accent: ac, grad: gr },
        { fonte: "poppins", efeito: "3d", accent: ac, grad: gr },
        { fonte: "serif", efeito: "sombra", accent: ac, grad: gr },
      ]);
      toast.success("3 modelos gerados a partir do exemplo. Toque pra aplicar.");
    } catch {
      toast.error("Não consegui ler o exemplo. Tente outra imagem.");
    }
  }

  function aplicarModelo(m: Modelo) {
    setFonte(m.fonte);
    setEfeito(m.efeito);
    setAccent(m.accent);
    if (escopo === "imagem") {
      setGrad(m.grad);
      setBg(null);
    }
  }

  async function recriarIA() {
    if (!ref0) return toast.error("Envie um exemplo primeiro.");
    if (!confirm(`Recriar 3 artes por IA. Custo estimado: ${brl(CUSTO_IA_IMG)} por imagem (≈ ${brl(CUSTO_IA_IMG * 3)} as 3). Continuar?`)) return;
    setIaLoading(true);
    try {
      const r = await gerarImagemIAAction(ref0, `${banda} concert poster art, instagram style, bold modern, space for text`, 3);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setIaImgs(r.imagens);
      toast.success(`${r.imagens.length} arte(s) recriada(s). Toque pra usar como fundo.`);
    } finally {
      setIaLoading(false);
    }
  }

  async function baixar() {
    const node = document.getElementById("agenda-poster");
    if (!node) return;
    setDownloading(true);
    try {
      await garantirFonte(FONTES[fonte].family);
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, {
        useCORS: true,
        backgroundColor: "#09090b",
        scale: 1080 / node.offsetWidth,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `agenda-${periodo}-${aspect === "9:16" ? "stories" : "feed"}.png`;
      a.click();
    } catch {
      toast.error("Falha ao exportar. Use 'Enviar foto' (link externo pode ser bloqueado).");
    } finally {
      setDownloading(false);
    }
  }

  const W = 300;
  const H = aspect === "9:16" ? Math.round((W * 16) / 9) : W;
  const a = scrim / 100;
  const fam = FONTES[fonte].family;
  const titleFx = fx(efeito, accent);
  const lineupValido = festival ? lineup.filter((b) => b.nome.trim()) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        <div
          id="agenda-poster"
          className="relative overflow-hidden rounded-xl ring-1 ring-zinc-800"
          style={{ width: W, height: H, background: bg ? "#000" : grad }}
        >
          {bg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-cover" />
          )}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, rgba(9,9,11,${a}), rgba(9,9,11,${Math.min(a + 0.12, 0.98)}))` }}
          />

          <div className="absolute inset-0 flex flex-col p-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>
                {festival ? (dataEvento.trim() || "Line-up") : "Agenda"}
              </p>
              <p className="font-black uppercase leading-none text-zinc-50" style={{ fontFamily: fam, fontSize: Math.round(30 * escalaTitulo), ...titleFx }}>
                {festival ? (evento.trim() || banda) : banda}
              </p>
            </div>
            <div className="my-3 h-0.5 w-full" style={{ background: accent }} />
            {festival ? (
              <ul className="flex-1 space-y-1.5 overflow-hidden">
                {lineupValido.length === 0 ? (
                  <li className="text-sm text-zinc-400">Adicione as bandas do line-up.</li>
                ) : (
                  lineupValido.map((b, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-zinc-50" style={{ textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>
                      {b.hora && <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: accent }}>{b.hora}</span>}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide">{b.nome}</span>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <ul className="flex-1 space-y-1.5 overflow-hidden">
                {filtrados.length === 0 ? (
                  <li className="text-sm text-zinc-400">Sem shows no período.</li>
                ) : (
                  filtrados.map((s, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-zinc-50" style={{ textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>
                      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: accent }}>{s.shortData}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.casa}</span>
                      <span className="shrink-0 text-xs text-zinc-300">{s.hora}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
            <p className="mt-2 text-center text-[9px] uppercase tracking-widest text-zinc-400">
              {banda} · ao vivo
            </p>
          </div>
        </div>
        <Button onClick={baixar} disabled={downloading} className="w-full bg-red-600 hover:bg-red-700">
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar {aspect === "9:16" ? "Stories (9:16)" : "Feed (1:1)"}
        </Button>
      </div>

      {/* Controles */}
      <div className="space-y-4">
        <Bloco titulo="Tipo de cartaz">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={festival} onChange={(e) => setFestival(e.target.checked)} className="size-4 accent-red-600" />
            Festival / line-up de um evento (em vez da agenda de shows)
          </label>
          {festival ? (
            <div className="mt-2 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-zinc-400">Nome do evento</Label>
                  <Input value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Ex.: Festival de Verão" className="h-9 bg-[#0f0f11]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-zinc-400">Data / dia</Label>
                  <Input value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} placeholder="Ex.: Sáb 12/07" className="h-9 bg-[#0f0f11]" />
                </div>
              </div>
              <Label className="text-[11px] text-zinc-400">Line-up — banda + horário de início</Label>
              {lineup.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={b.nome} onChange={(e) => setLineup((p) => p.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} placeholder="Banda" className="h-9 flex-1 bg-[#0f0f11]" />
                  <Input value={b.hora} onChange={(e) => setLineup((p) => p.map((x, j) => (j === i ? { ...x, hora: e.target.value } : x)))} placeholder="22h" className="h-9 w-20 bg-[#0f0f11]" />
                  <button onClick={() => setLineup((p) => p.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400" title="Remover">
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLineup((p) => [...p, { nome: "", hora: "" }])}>
                <Plus className="size-4" /> Adicionar banda
              </Button>
            </div>
          ) : (
            <div className="mt-2">
              <Label className="text-[11px] text-zinc-400">Período da agenda</Label>
              <div className="mt-1">
                <Chips value={periodo} onChange={setPeriodo} options={PERIODOS.map((p) => [p.key, p.label] as [string, string])} />
              </div>
            </div>
          )}
        </Bloco>
        <Bloco titulo="Fonte">
          <Chips value={fonte} onChange={setFonte} options={Object.entries(FONTES).map(([k, v]) => [k, v.label] as [string, string])} />
        </Bloco>
        <Bloco titulo="Efeito do texto">
          <Chips value={efeito} onChange={(v) => setEfeito(v as Efeito)} options={EFEITOS} />
        </Bloco>
        <Bloco titulo={`Tamanho do título · ${Math.round(escalaTitulo * 100)}%`}>
          <input type="range" min={60} max={180} value={Math.round(escalaTitulo * 100)} onChange={(e) => setEscalaTitulo(Number(e.target.value) / 100)} className="w-full accent-red-600" />
        </Bloco>
        <Bloco titulo="Cor de destaque">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setAccent(c)} className={cn("size-8 rounded-full ring-2", accent === c ? "ring-white" : "ring-transparent")} style={{ background: c }} />
            ))}
          </div>
        </Bloco>
        <Bloco titulo="Formato">
          <Chips value={aspect} onChange={(v) => setAspect(v as "9:16" | "1:1")} options={[["9:16", "Stories"], ["1:1", "Feed"]]} />
        </Bloco>
        <Bloco titulo={`Transparência do fundo · ${scrim}%`}>
          <input type="range" min={0} max={95} value={scrim} onChange={(e) => setScrim(Number(e.target.value))} className="w-full accent-red-600" />
          <p className="text-[11px] text-zinc-500">Menos = a foto aparece mais. Mais = escurece pra leitura da lista.</p>
        </Bloco>

        <Bloco titulo={festival ? `Fundo · ${lineupValido.length} banda(s)` : `Fundo · ${filtrados.length} show(s)`}>
          <div className="mb-2 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Enviar foto
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && onUpload(e.target.files)} />
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
                <button
                  key={im.id}
                  onClick={() => setBg(im.url)}
                  className={cn("aspect-square overflow-hidden rounded-md border", bg === im.url ? "border-primary ring-1 ring-primary" : "border-zinc-700")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </Bloco>

        <Bloco titulo="Inspiração: gerar modelos a partir de um exemplo">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
              <ImageIcon className="size-4" /> Enviar exemplo
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setRef0(await fileToDownscaledDataUrl(f, 900, 0.7)); setModelos([]); setIaImgs([]); } }} />
            </label>
            {ref0 && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref0} alt="referência" className="h-16 w-12 rounded object-cover ring-1 ring-zinc-700" />
                <button onClick={() => { setRef0(null); setModelos([]); setIaImgs([]); }} className="text-xs text-zinc-500 hover:text-foreground">remover</button>
              </>
            )}
          </div>
          {ref0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-zinc-400">Aplicar em</Label>
                <Chips value={escopo} onChange={(v) => setEscopo(v as Escopo)} options={[["imagem", "Toda a imagem"], ["texto", "Só o texto"]]} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={gerarModelos} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
                  <Wand2 className="size-4" /> Gerar 3 modelos (grátis)
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setImgs((p) => [{ id: `ex-${Date.now()}`, url: ref0 }, ...p]); setBg(ref0); toast.success("Exemplo aplicado como fundo."); }}>
                  <ImageIcon className="size-4" /> Usar como fundo (grátis)
                </Button>
                <Button size="sm" variant="outline" onClick={recriarIA} disabled={iaLoading} className="border-amber-600/50">
                  {iaLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-amber-400" />} Recriar com IA · ~{brl(CUSTO_IA_IMG * 3)}
                </Button>
              </div>
            </div>
          )}
          {iaImgs.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] text-zinc-400">Artes recriadas por IA — toque pra usar como fundo:</p>
              <div className="grid grid-cols-3 gap-2">
                {iaImgs.map((u, i) => (
                  <button key={i} onClick={() => { setImgs((p) => [{ id: `ia-${i}-${Date.now()}`, url: u }, ...p]); setBg(u); }} className="aspect-9/16 overflow-hidden rounded-md ring-1 ring-zinc-700 hover:ring-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" crossOrigin="anonymous" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {modelos.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] text-zinc-400">
                Modelos (paleta do exemplo) — toque pra aplicar {escopo === "imagem" ? "na imagem toda (fundo + texto)" : "só no texto (mantém seu fundo)"}:
              </p>
              <div className="flex gap-2">
                {modelos.map((m, i) => (
                  <button key={i} onClick={() => aplicarModelo(m)} className="flex-1 overflow-hidden rounded-lg ring-1 ring-zinc-700 hover:ring-primary" style={{ background: escopo === "imagem" ? m.grad : "#18181b" }}>
                    <div className="flex h-20 flex-col items-center justify-center gap-1 p-2">
                      <span className="text-base font-black uppercase leading-none text-zinc-50" style={{ fontFamily: FONTES[m.fonte].family, ...fx(m.efeito, m.accent) }}>Aa</span>
                      <span className="h-1 w-8 rounded-full" style={{ background: m.accent }} />
                      <span className="text-[9px] uppercase tracking-wide text-zinc-300">{FONTES[m.fonte].label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">
            <strong>Grátis:</strong> “Gerar 3 modelos” usa só as cores/clima; “Usar como fundo” põe o próprio exemplo de fundo. <strong>Pago:</strong> “Recriar com IA” desenha arte nova parecida — custo estimado {brl(CUSTO_IA_IMG)}/imagem, precisa da env FAL_KEY; sem a key, avisa e não cobra.
          </p>
        </Bloco>
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
          className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", value === v ? "border-primary bg-primary/20 text-primary" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
