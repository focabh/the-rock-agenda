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

const PERIODOS: { key: string; label: string; dias: number }[] = [
  { key: "semanal", label: "Semana", dias: 7 },
  { key: "quinzenal", label: "Quinzena", dias: 15 },
  { key: "mensal", label: "Mês", dias: 30 },
  { key: "2meses", label: "2 meses", dias: 60 },
  { key: "3meses", label: "3 meses", dias: 90 },
];

const GRADIENTES = [
  "linear-gradient(160deg,#1a0a0a,#09090b 60%)",
  "linear-gradient(160deg,#0a0a1a,#09090b 60%)",
  "linear-gradient(160deg,#18120a,#09090b 60%)",
];

export function AgendaPosterStudio({
  banda,
  logoUrl,
  shows,
  galeria,
}: {
  banda: string;
  logoUrl: string | null;
  shows: PosterShow[];
  galeria: { id: string; url: string }[];
}) {
  const [periodo, setPeriodo] = useState("mensal");
  const [imgs, setImgs] = useState(galeria);
  const [bg, setBg] = useState<string | null>(null);
  const [grad, setGrad] = useState(GRADIENTES[0]);
  const [aspect, setAspect] = useState<"9:16" | "1:1">("9:16");
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

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        <div
          id="agenda-poster"
          className="relative overflow-hidden rounded-lg"
          style={{ width: W, height: H, background: bg ? "#000" : grad }}
        >
          {bg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(9,9,11,0.82), rgba(9,9,11,0.92))" }} />

          <div className="absolute inset-0 flex flex-col p-4">
            <div className="flex items-center gap-2.5">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" crossOrigin="anonymous" className="size-10 shrink-0 rounded-md object-contain ring-1 ring-white/15" />
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-amber-400">Agenda</p>
                <p className="text-2xl font-black leading-none text-zinc-100">{banda}</p>
              </div>
            </div>
            <div className="my-3 h-px w-full bg-red-600/70" />
            <ul className="flex-1 space-y-1.5 overflow-hidden">
              {filtrados.length === 0 ? (
                <li className="text-sm text-zinc-400">Sem shows no período.</li>
              ) : (
                filtrados.map((s, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-zinc-100">
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-amber-400">{s.shortData}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.casa}</span>
                    <span className="shrink-0 font-mono text-xs text-zinc-400">{s.hora}</span>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-2 text-center text-[9px] uppercase tracking-widest text-zinc-500">
              {banda} · ao vivo
            </p>
          </div>
        </div>
        <Button onClick={baixar} disabled={downloading} className="w-full">
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar {aspect === "9:16" ? "Stories (9:16)" : "Feed (1:1)"}
        </Button>
      </div>

      {/* Controles */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                periodo === p.key ? "border-primary bg-primary/20 text-primary" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["9:16", "1:1"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                aspect === a ? "border-primary bg-primary/20 text-primary" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              )}
            >
              {a === "9:16" ? "Stories 9:16" : "Feed 1:1"}
            </button>
          ))}
        </div>

        <Card className="border-zinc-800 bg-[#18181b]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-100">
                Fundo · <span className="text-zinc-400">{filtrados.length} show(s)</span>
              </p>
              <div className="flex gap-2">
                {imgs.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setBg(imgs[Math.floor(Math.random() * imgs.length)].url)}>
                    <Shuffle className="size-4" /> Sortear
                  </Button>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Enviar foto
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && onUpload(e.target.files)} />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setBg(null)} className={cn("size-12 rounded-md border", !bg ? "border-primary" : "border-zinc-700")} style={{ background: grad }} title="Sem foto" />
              {GRADIENTES.map((g) => (
                <button key={g} onClick={() => { setGrad(g); setBg(null); }} className="size-12 rounded-md border border-zinc-700" style={{ background: g }} />
              ))}
            </div>
            {imgs.length > 0 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
