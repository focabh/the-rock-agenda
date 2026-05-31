"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Upload, Shuffle, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fileToDownscaledDataUrl } from "@/lib/image-resize";
import { addImagemDivulgacaoAction, deleteImagemDivulgacaoAction } from "@/app/(app)/shows/[id]/divulgacao/actions";

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

function baixarCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("canvas vazio"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, "image/png");
  });
}

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
        const res = await addImagemDivulgacaoAction(url);
        const id = res.id ?? `local-${Date.now()}-${Math.round(performance.now())}`;
        setImgs((p) => [{ id, url }, ...p]);
        if (primeira) { setBg(url); primeira = false; }
      }
      if (arr.length > 1) toast.success(`${arr.length} fotos adicionadas.`);
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
      await baixarCanvas(canvas, `agenda-${periodo}-${aspect === "9:16" ? "stories" : "feed"}.png`);
    } catch (e) {
      toast.error("Falha ao exportar: " + (e instanceof Error ? e.message : "erro desconhecido") + ". Use 'Enviar foto' (link externo pode ser bloqueado).");
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
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="" aria-hidden crossOrigin="anonymous" className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-lg" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-contain" />
            </>
          )}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, rgba(9,9,11,${a}), rgba(9,9,11,${Math.min(a + 0.12, 0.98)}))` }}
          />

          <div className="absolute inset-0 flex flex-col p-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em]" style={{ fontFamily: fam, color: accent, ...titleFx }}>
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
                    <li key={i} className="flex items-baseline gap-2 text-zinc-50" style={{ fontFamily: fam, ...titleFx }}>
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
                    <li key={i} className="flex items-baseline gap-2 text-zinc-50" style={{ fontFamily: fam, ...titleFx }}>
                      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: accent }}>{s.shortData}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.casa}</span>
                      <span className="shrink-0 text-xs text-zinc-300">{s.hora}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
            <p className="mt-2 text-center text-[9px] uppercase tracking-widest text-zinc-400" style={{ fontFamily: fam }}>
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

        <Bloco titulo="Modelos de texto">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {MODELOS_TEXTO.map((m) => {
              const ativo = fonte === m.fonte && efeito === m.efeito && accent === m.accent;
              return (
                <button
                  key={m.nome}
                  onClick={() => { setFonte(m.fonte); setEfeito(m.efeito); setAccent(m.accent); }}
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
