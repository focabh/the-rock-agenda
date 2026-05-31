"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download, Upload, Shuffle, Loader2, Building2, Plus, X, GripVertical } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fileToDownscaledDataUrl } from "@/lib/image-resize";
import { addImagemDivulgacaoAction, deleteImagemDivulgacaoAction } from "@/app/(app)/shows/[id]/divulgacao/actions";

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
type Efeito = "nenhum" | "sombra" | "contorno" | "neon" | "3d" | "longa" | "brilho" | "duplo";
type Banda = { nome: string; hora: string };

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

const GRADIENTES = [
  "radial-gradient(120% 90% at 50% 0%, #2a0a0a, #09090b 65%)",
  "radial-gradient(120% 90% at 50% 0%, #0a1430, #09090b 65%)",
  "linear-gradient(135deg, #18120a, #09090b 70%)",
  "linear-gradient(135deg, #1a0a1e, #09090b 70%)",
];

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

// 10 estilos de texto prontos (fonte + efeito + cor de destaque).
const MODELOS_TEXTO: { nome: string; fonte: string; efeito: Efeito; accent: string }[] = [
  { nome: "Neon", fonte: "anton", efeito: "neon", accent: "#f59e0b" },
  { nome: "Festival", fonte: "archivo", efeito: "3d", accent: "#ef4444" },
  { nome: "Clean", fonte: "montserrat", efeito: "sombra", accent: "#fafafa" },
  { nome: "Elegante", fonte: "serif", efeito: "sombra", accent: "#fafafa" },
  { nome: "Glamour", fonte: "abril", efeito: "contorno", accent: "#f472b6" },
  { nome: "Marcador", fonte: "marker", efeito: "contorno", accent: "#a3e635" },
  { nome: "Praia", fonte: "pacifico", efeito: "sombra", accent: "#22d3ee" },
  { nome: "Estádio", fonte: "oswald", efeito: "longa", accent: "#f59e0b" },
  { nome: "Retrô", fonte: "righteous", efeito: "3d", accent: "#22d3ee" },
  { nome: "Alta tensão", fonte: "bebas", efeito: "duplo", accent: "#ef4444" },
];

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
const pillText = (accent: string) => (accent === "#ef4444" ? "#fff" : "#09090b");

/** Efeitos como CAMADAS de texto (cópias posicionadas atrás), não text-shadow:
 *  o text-shadow some na exportação (o Webkit/iOS não pinta sombra/filtro no
 *  modo SVG/foreignObject que o screenshot usa). Cópias de texto são glifos
 *  reais → aparecem em qualquer aparelho. */
function fxLayers(efeito: Efeito, accent: string): { dx: number; dy: number; color: string }[] {
  const dirs = (d: number, color: string) =>
    ([[-d, -d], [d, -d], [-d, d], [d, d], [0, -d], [0, d], [-d, 0], [d, 0]] as const).map(([dx, dy]) => ({ dx, dy, color }));
  switch (efeito) {
    case "sombra":
      return [{ dx: 0, dy: 1, color: "rgba(0,0,0,.55)" }, { dx: 0, dy: 2, color: "rgba(0,0,0,.45)" }, { dx: 1, dy: 3, color: "rgba(0,0,0,.3)" }];
    case "contorno":
      return dirs(1, "#000");
    case "3d":
      return [{ dx: 1, dy: 1, color: accent }, { dx: 2, dy: 2, color: accent }, { dx: 3, dy: 3, color: "rgba(0,0,0,.7)" }, { dx: 4, dy: 4, color: "rgba(0,0,0,.5)" }, { dx: 5, dy: 5, color: "rgba(0,0,0,.3)" }];
    case "longa":
      return Array.from({ length: 8 }, (_, k) => ({ dx: k + 1, dy: k + 1, color: `rgba(0,0,0,${(0.5 * (1 - k / 8)).toFixed(2)})` }));
    case "neon":
      return [...dirs(3, accent + "4d"), ...dirs(2, accent + "80"), ...dirs(1, accent + "e6")];
    case "brilho":
      return [...dirs(3, accent + "4d"), ...dirs(2, accent + "99"), ...dirs(1, "#ffffffe6")];
    case "duplo":
      return [...dirs(2, accent), ...dirs(1, "#000")];
    default:
      return [];
  }
}

/** Texto com efeito por camadas (exporta em qualquer aparelho). */
function TextoFx({
  efeito, accent, children, className, style,
}: {
  efeito: Efeito; accent: string; children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const layers = fxLayers(efeito, accent);
  if (layers.length === 0) return <span className={className} style={style}>{children}</span>;
  return (
    <span className={cn("relative inline-block", className)} style={style}>
      {layers.map((l, i) => (
        <span key={i} aria-hidden className="pointer-events-none absolute left-0 top-0 w-full" style={{ color: l.color, transform: `translate(${l.dx}px, ${l.dy}px)` }}>
          {children}
        </span>
      ))}
      <span className="relative">{children}</span>
    </span>
  );
}

/** Salva a imagem do jeito que funciona no aparelho:
 *  - Celular (iOS/Android): Web Share API → folha de compartilhar (Salvar
 *    imagem / mandar pro Instagram). Anchor download não funciona no iOS.
 *  - Desktop: download via Blob URL (data: URL grande é bloqueado pelo Chrome). */
async function baixarBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && typeof nav.share === "function") {
    try {
      await nav.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // usuário cancelou
      // outro erro → cai pro download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Garante que a fonte foi baixada antes de rasterizar (html2canvas não
 *  espera web fonts sozinho → exportava com fallback). */
async function garantirFonte(familyCss: string) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const fam = familyCss.split(",")[0].trim();
  try {
    await Promise.all([document.fonts.load(`700 48px ${fam}`), document.fonts.load(`400 48px ${fam}`)]);
    await document.fonts.ready;
  } catch {
    /* ignora — segue com fallback */
  }
}

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
  const [escala, setEscala] = useState(1);
  const [tam, setTam] = useState<Record<string, number>>({ chamada: 1, banda: 1, casa: 1, data: 1, ingresso: 1, lineup: 1 });
  const setTamKey = (k: string, v: number) => setTam((p) => ({ ...p, [k]: v }));
  const [ordem, setOrdem] = useState<string[]>(["chamada", "banda", "lineup", "data", "casa", "ingresso"]);
  const ordemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  function onOrdemDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const vis = ordem.filter((k) => k !== "lineup" || festival);
    const oldIdx = vis.indexOf(String(active.id));
    const newIdx = vis.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const newVis = arrayMove(vis, oldIdx, newIdx);
    // Reconstrói a ordem completa mantendo o line-up no lugar quando oculto.
    let vi = 0;
    setOrdem(ordem.map((k) => (k === "lineup" && !festival ? k : newVis[vi++])));
  }
  const [tarjaOp, setTarjaOp] = useState(78);
  const [textPos, setTextPos] = useState({ x: 20, y: 0 });

  const [headline, setHeadline] = useState("AO VIVO");
  const [banda, setBanda] = useState(show.banda);
  const [casa, setCasa] = useState(show.casaNome);
  const [data, setData] = useState(show.dataLabel);
  const [ingresso, setIngresso] = useState(show.valorIngresso ?? "");
  const [link, setLink] = useState(show.linkVendas ?? "");

  const [festival, setFestival] = useState(false);
  const [evento, setEvento] = useState("");
  const [lineup, setLineup] = useState<Banda[]>([{ nome: show.banda, hora: show.inicio ?? "" }]);

  const [qr, setQr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    const l = link.trim();
    if (!l) return setQr(null);
    import("qrcode").then((Q) => Q.toDataURL(l, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(null)));
  }, [link]);

  // Encaixa o bloco de texto na região do preset; arrastar depois ajusta fino.
  useEffect(() => {
    const h = aspect === "9:16" ? Math.round((300 * 16) / 9) : 300;
    const y = pos === "top" ? 18 : pos === "center" ? Math.round(h / 2 - 70) : h - 175;
    setTextPos({ x: 20, y });
  }, [pos, aspect]);

  function onDragStart(e: React.PointerEvent) {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: textPos.x, py: textPos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setTextPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  }
  function onDragEnd() {
    dragging.current = false;
  }

  function onUpload(files: FileList) {
    const arr = Array.from(files);
    start(async () => {
      let first = true;
      for (const f of arr) {
        const url = await fileToDownscaledDataUrl(f, 1600, 0.82);
        const res = await addImagemDivulgacaoAction(url);
        const id = res.id ?? `local-${Date.now()}-${Math.round(performance.now())}`;
        setImgs((p) => [{ id, url }, ...p]);
        if (first) { setBg(url); first = false; }
      }
    });
  }

  async function excluirImg(id: string, url: string) {
    setImgs((p) => p.filter((im) => im.id !== id));
    if (bg === url) setBg(null);
    if (!/^(local|ia|ex)-/.test(id)) {
      try { await deleteImagemDivulgacaoAction(id); } catch { /* já saiu da lista */ }
    }
  }

  async function baixar() {
    if (!ref.current) return;
    setDownloading(true);
    try {
      await garantirFonte(fam);
      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(ref.current, { scale: 1080 / ref.current.offsetWidth, backgroundColor: "#09090b", type: "image/png" });
      await baixarBlob(blob, `flyer-${aspect === "9:16" ? "stories" : "feed"}.png`);
    } catch (e) {
      toast.error("Falha ao exportar: " + (e instanceof Error ? e.message : "erro desconhecido") + ". Se usou link de imagem externo, envie a foto.");
    } finally {
      setDownloading(false);
    }
  }

  const W = 300;
  const H = aspect === "9:16" ? Math.round((W * 16) / 9) : W;
  const aA = scrim / 100;
  const scrimBg =
    pos === "top"
      ? `linear-gradient(to bottom, rgba(9,9,11,${aA + 0.25}), rgba(9,9,11,${aA * 0.4}) 45%, transparent 72%)`
      : pos === "center"
        ? `radial-gradient(130% 75% at 50% 50%, rgba(9,9,11,${aA + 0.2}), rgba(9,9,11,${aA * 0.5}) 65%, transparent)`
        : `linear-gradient(to top, rgba(9,9,11,${aA + 0.3}), rgba(9,9,11,${aA * 0.45}) 45%, transparent 74%)`;

  const fam = FONTES[fonte].family;
  const lineupValido = festival ? lineup.filter((b) => b.nome.trim()) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col items-center gap-3">
        <div ref={ref} className="relative overflow-hidden rounded-xl ring-1 ring-zinc-800" style={{ width: W, height: H, background: bg ? "#000" : grad }}>
          {bg && (
            <>
              {/* preenchimento borrado atrás pra não sobrar barra preta */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="" aria-hidden crossOrigin="anonymous" className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-lg" />
              {/* foto inteira, sem cortar */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-contain" />
            </>
          )}
          <div className="absolute inset-0" style={{ background: scrimBg }} />
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            className="absolute cursor-move touch-none select-none"
            style={{ left: textPos.x, top: textPos.y, width: W - 40 }}
            title="Arraste para posicionar o texto"
          >
            <Conteudo estilo={estilo} fam={fam} efeito={efeito} accent={accent} escala={escala} tam={tam} tarjaOp={tarjaOp} ordem={ordem} headline={headline} banda={banda} casa={casa} data={data} inicio={show.inicio} ingresso={ingresso} qr={qr} festival={festival} evento={evento} lineup={lineupValido} />
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
        <Bloco titulo="Modelos de texto">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {MODELOS_TEXTO.map((m) => {
              const ativo = fonte === m.fonte && efeito === m.efeito && accent === m.accent;
              return (
                <button
                  key={m.nome}
                  onClick={() => {
                    if (ativo) { setFonte("anton"); setEfeito("sombra"); setAccent("#f59e0b"); }
                    else { setFonte(m.fonte); setEfeito(m.efeito); setAccent(m.accent); }
                  }}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border p-2", ativo ? "border-primary ring-1 ring-primary" : "border-zinc-700 hover:border-zinc-500")}
                >
                  <span className="text-xl font-black uppercase leading-none text-zinc-50" style={{ fontFamily: FONTES[m.fonte].family, ...fx(m.efeito, m.accent) }}>Aa</span>
                  <span className="text-[10px] text-zinc-400">{m.nome}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-500">Aplica fonte + efeito + cor num clique. Dá pra ajustar nos controles abaixo.</p>
        </Bloco>
        <Bloco titulo="Fonte">
          <Chips value={fonte} onChange={setFonte} options={Object.entries(FONTES).map(([k, v]) => [k, v.label] as [string, string])} />
        </Bloco>
        <Bloco titulo="Efeito do texto">
          <Chips value={efeito} onChange={(v) => setEfeito(v as Efeito)} options={EFEITOS} />
        </Bloco>
        <Bloco titulo="Cor de destaque">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setAccent(c)} className={cn("size-8 rounded-full ring-2", accent === c ? "ring-white" : "ring-transparent")} style={{ background: c }} />
            ))}
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 text-xs text-zinc-300">
              custom
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="size-6 cursor-pointer bg-transparent" />
            </span>
          </div>
        </Bloco>
        {estilo === "tarja" && (
          <Bloco titulo={`Transparência da tarja · ${tarjaOp}%`}>
            <input type="range" min={0} max={100} value={tarjaOp} onChange={(e) => setTarjaOp(Number(e.target.value))} className="w-full accent-red-600" />
            <p className="text-[11px] text-zinc-500">0% = tarja invisível · 100% = preto sólido atrás do texto.</p>
          </Bloco>
        )}
        <Bloco titulo="Formato e posição">
          <div className="flex flex-wrap gap-2">
            <Chips value={aspect} onChange={(v) => setAspect(v as "9:16" | "1:1")} options={[["9:16", "Stories"], ["1:1", "Feed"]]} />
            <Chips value={pos} onChange={(v) => setPos(v as Pos)} options={[["top", "Topo"], ["center", "Centro"], ["bottom", "Rodapé"]]} />
          </div>
          <p className="text-[11px] text-zinc-500">Escolha uma região e depois <strong>arraste o texto</strong> direto no preview pra posicionar livremente.</p>
        </Bloco>
        <Bloco titulo={`Tamanho do texto (geral) · ${Math.round(escala * 100)}%`}>
          <input type="range" min={60} max={170} value={Math.round(escala * 100)} onChange={(e) => setEscala(Number(e.target.value) / 100)} className="w-full accent-red-600" />
          <p className="text-[11px] text-zinc-500">Escala todos os textos juntos. Pra ajustar um por um, use as mini-barras no bloco “Textos”.</p>
        </Bloco>
        <Bloco titulo={`Transparência do fundo · ${scrim}%`}>
          <input type="range" min={0} max={95} value={scrim} onChange={(e) => setScrim(Number(e.target.value))} className="w-full accent-red-600" />
          <p className="text-[11px] text-zinc-500">Menos = a foto aparece mais. Mais = escurece pra leitura.</p>
        </Bloco>

        <Bloco titulo="Festival / várias bandas">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={festival} onChange={(e) => setFestival(e.target.checked)} className="size-4 accent-red-600" />
            É um festival / line-up com mais de uma banda
          </label>
          {festival && (
            <div className="mt-2 space-y-2">
              <Campo label="Nome do evento (opcional)" value={evento} onChange={setEvento} placeholder="Ex.: Festival de Verão" />
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
              <div className="flex items-center gap-1.5 px-0.5">
                <span className="text-[9px] uppercase tracking-wide text-zinc-500">tam line-up {Math.round(tam.lineup * 100)}%</span>
                <input type="range" min={40} max={220} value={Math.round(tam.lineup * 100)} onChange={(e) => setTamKey("lineup", Number(e.target.value) / 100)} className="h-1 flex-1 accent-red-600" />
              </div>
              <p className="text-[11px] text-zinc-500">No modo festival o line-up aparece no flyer no lugar da banda única.</p>
            </div>
          )}
        </Bloco>

        <Bloco titulo="Textos">
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo label="Chamada" value={headline} onChange={setHeadline} size={tam.chamada} onSize={(v) => setTamKey("chamada", v)} />
            <Campo label="Banda" value={banda} onChange={setBanda} size={tam.banda} onSize={(v) => setTamKey("banda", v)} />
            <Campo label="Casa / local" value={casa} onChange={setCasa} size={tam.casa} onSize={(v) => setTamKey("casa", v)} />
            <Campo label="Data" value={data} onChange={setData} size={tam.data} onSize={(v) => setTamKey("data", v)} />
            <Campo label="Ingresso" value={ingresso} onChange={setIngresso} placeholder="R$ 20 / Gratuito" size={tam.ingresso} onSize={(v) => setTamKey("ingresso", v)} />
            <Campo label="Link de venda (vira QR)" value={link} onChange={setLink} placeholder="https://…" />
          </div>
          <p className="text-[11px] text-zinc-500">Cada texto tem seu próprio tamanho (mini-barra abaixo do campo). A barra “Tamanho do texto” lá em cima escala todos de uma vez.</p>
        </Bloco>

        <Bloco titulo="Ordem dos textos">
          <DndContext sensors={ordemSensors} collisionDetection={closestCenter} onDragEnd={onOrdemDragEnd}>
            <SortableContext items={ordem.filter((k) => k !== "lineup" || festival)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {ordem
                  .filter((k) => k !== "lineup" || festival)
                  .map((k) => (
                    <OrdemItem key={k} id={k} label={{ chamada: "Chamada", banda: festival ? "Evento" : "Banda", lineup: "Line-up", data: "Data", casa: "Casa / local", ingresso: "Ingresso" }[k] ?? k} />
                  ))}
              </div>
            </SortableContext>
          </DndContext>
          <p className="text-[11px] text-zinc-500">Arraste pra reordenar como os textos aparecem no flyer. O QR fica por último.</p>
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
                <div key={im.id} className="relative">
                  <button onClick={() => setBg(im.url)} className={cn("aspect-square w-full overflow-hidden rounded-md border", bg === im.url ? "border-primary ring-1 ring-primary" : "border-zinc-700")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" className="size-full object-cover" />
                  </button>
                  <button onClick={() => excluirImg(im.id, im.url)} className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900/90 p-0.5 text-zinc-300 ring-1 ring-zinc-700 hover:text-red-400" title="Excluir foto">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Bloco>
      </div>
    </div>
  );
}

function Conteudo({
  estilo, fam, efeito, accent, escala, tam, tarjaOp, ordem, headline, banda, casa, data, inicio, ingresso, qr, festival, evento, lineup,
}: {
  estilo: Estilo; fam: string; efeito: Efeito; accent: string; escala: number; tam: Record<string, number>; tarjaOp: number; ordem: string[]; headline: string; banda: string; casa: string; data: string; inicio: string | null; ingresso: string; qr: string | null; festival: boolean; evento: string; lineup: Banda[];
}) {
  const tituloPrincipal = festival ? (evento.trim() || "FESTIVAL") : banda;
  const dataTxt = data + (!festival && inicio ? ` · ${inicio}` : "");
  const pill = estilo === "festival"; // festival usa "pílulas" em chamada/ingresso

  const t = (extra?: React.CSSProperties): React.CSSProperties => ({ fontFamily: fam, ...extra });
  const sz = (key: string, basePx: number, extra?: React.CSSProperties): React.CSSProperties =>
    ({ ...t(extra), fontSize: Math.round(basePx * escala * (tam[key] ?? 1)) });
  const bandaBase = estilo === "festival" ? (festival ? 36 : 48) : estilo === "minimal" ? 30 : 26;

  // Cada item de texto é um bloco; renderizamos na ordem escolhida (`ordem`).
  // Os efeitos são camadas de texto (TextoFx) pra exportarem em qualquer aparelho.
  const ITENS: Record<string, React.ReactNode> = {
    chamada: headline ? (
      pill ? (
        <div key="chamada"><span className="inline-block px-2 py-0.5 font-bold uppercase tracking-[0.2em]" style={sz("chamada", 11, { background: accent, color: pillText(accent) })}>{headline}</span></div>
      ) : (
        <div key="chamada"><TextoFx efeito={efeito} accent={accent} className="uppercase tracking-[0.3em]" style={sz("chamada", 11, { color: accent })}>{headline}</TextoFx></div>
      )
    ) : null,
    banda: (
      <div key="banda">
        <TextoFx efeito={efeito} accent={accent} className="font-black uppercase leading-[0.9] text-zinc-50" style={sz("banda", bandaBase)}>{tituloPrincipal}</TextoFx>
      </div>
    ),
    lineup: festival && lineup.length > 0 ? (
      <ul key="lineup" className="space-y-0.5">
        {lineup.map((b, i) => (
          <li key={i} className="flex items-baseline gap-2 text-zinc-50" style={sz("lineup", 14)}>
            {b.hora && <span className="shrink-0 font-bold tabular-nums" style={{ color: accent }}>{b.hora}</span>}
            <TextoFx efeito={efeito} accent={accent} className="font-semibold uppercase tracking-wide">{b.nome}</TextoFx>
          </li>
        ))}
      </ul>
    ) : null,
    data: dataTxt.trim() ? (
      <div key="data"><TextoFx efeito={efeito} accent={accent} className="font-bold" style={sz("data", estilo === "festival" ? 18 : 13, { color: estilo === "festival" ? accent : "#d4d4d8" })}>{dataTxt}</TextoFx></div>
    ) : null,
    casa: casa.trim() ? (
      <div key="casa"><TextoFx efeito={efeito} accent={accent} className="font-semibold uppercase tracking-wide text-zinc-100" style={sz("casa", 14)}>{casa}</TextoFx></div>
    ) : null,
    ingresso: ingresso.trim() ? (
      pill ? (
        <div key="ingresso"><span className="inline-block rounded-full px-2.5 py-0.5 font-bold" style={sz("ingresso", 13, { background: accent, color: pillText(accent) })}>{ingresso}</span></div>
      ) : (
        <div key="ingresso"><TextoFx efeito={efeito} accent={accent} className="font-semibold" style={sz("ingresso", 12, { color: accent })}>{ingresso}</TextoFx></div>
      )
    ) : null,
  };

  const QR = qr ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img key="qr" src={qr} alt="QR" className="mt-1 size-14 rounded bg-white p-0.5" />
  ) : null;

  const wrapper: React.CSSProperties | undefined =
    estilo === "tarja" ? { background: `rgba(9,9,11,${tarjaOp / 100})`, border: `1px solid ${accent}`, borderRadius: 10, padding: 12, backdropFilter: "blur(2px)" } : undefined;

  return (
    <div className="w-full space-y-1.5" style={wrapper}>
      {ordem.map((k) => ITENS[k]).filter(Boolean)}
      {QR}
    </div>
  );
}

function OrdemItem({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0f0f11] px-2.5 py-2",
        isDragging && "z-10 ring-1 ring-primary/50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-zinc-500 hover:text-zinc-200 active:cursor-grabbing"
        title="Arrastar para reordenar"
        aria-label="Arrastar"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="text-sm text-zinc-200">{label}</span>
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

function Campo({ label, value, onChange, placeholder, size, onSize }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; size?: number; onSize?: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-zinc-400">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 bg-[#0f0f11]" />
      {onSize && size !== undefined && (
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="text-[9px] uppercase tracking-wide text-zinc-500">tam {Math.round(size * 100)}%</span>
          <input type="range" min={40} max={220} value={Math.round(size * 100)} onChange={(e) => onSize(Number(e.target.value) / 100)} className="h-1 flex-1 accent-red-600" />
        </div>
      )}
    </div>
  );
}
