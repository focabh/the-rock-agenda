"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Upload, Shuffle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fileToDownscaledDataUrl } from "@/lib/image-resize";
import { addImagemDivulgacaoAction } from "@/app/(app)/shows/[id]/divulgacao/actions";

export type PosterShow = {
  ts: number;
  shortData: string;
  dia: string;
  hora: string;
  casa: string;
  cidade: string | null;
};

type Efeito = "nenhum" | "sombra" | "contorno" | "neon";

const FONTES: Record<string, { label: string; family: string }> = {
  anton: { label: "Impacto", family: "'Anton', system-ui, sans-serif" },
  poppins: { label: "Moderna", family: "'Poppins', system-ui, sans-serif" },
  barlow: { label: "Condensada", family: "'Barlow Condensed', system-ui, sans-serif" },
  serif: { label: "Elegante", family: "'Playfair Display', Georgia, serif" },
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
  const [downloading, setDownloading] = useState(false);
  const [pending, start] = useTransition();

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

  async function baixar() {
    const node = document.getElementById("agenda-poster");
    if (!node) return;
    setDownloading(true);
    try {
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
              <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>Agenda</p>
              <p className="text-3xl font-black uppercase leading-none text-zinc-50" style={{ fontFamily: fam, ...titleFx }}>{banda}</p>
            </div>
            <div className="my-3 h-0.5 w-full" style={{ background: accent }} />
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
        <Bloco titulo="Período">
          <Chips value={periodo} onChange={setPeriodo} options={PERIODOS.map((p) => [p.key, p.label] as [string, string])} />
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
        <Bloco titulo="Formato">
          <Chips value={aspect} onChange={(v) => setAspect(v as "9:16" | "1:1")} options={[["9:16", "Stories"], ["1:1", "Feed"]]} />
        </Bloco>
        <Bloco titulo={`Transparência do fundo · ${scrim}%`}>
          <input type="range" min={0} max={95} value={scrim} onChange={(e) => setScrim(Number(e.target.value))} className="w-full accent-red-600" />
          <p className="text-[11px] text-zinc-500">Menos = a foto aparece mais. Mais = escurece pra leitura da lista.</p>
        </Bloco>

        <Bloco titulo={`Fundo · ${filtrados.length} show(s)`}>
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
