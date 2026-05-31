"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download, Upload, Shuffle, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addImagemDivulgacaoAction } from "@/app/(app)/shows/[id]/divulgacao/actions";

type Show = {
  banda: string;
  casaNome: string;
  dataLabel: string;
  inicio: string | null;
  termino: string | null;
  valorIngresso: string | null;
  linkVendas: string | null;
};

const GRADIENTES = [
  "linear-gradient(160deg,#1a0a0a,#09090b 60%)",
  "linear-gradient(160deg,#0a0a1a,#09090b 60%)",
  "linear-gradient(160deg,#18120a,#09090b 60%)",
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
  const [qr, setQr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show.linkVendas) return setQr(null);
    import("qrcode")
      .then((Q) => Q.toDataURL(show.linkVendas!, { margin: 1, width: 220 }))
      .then(setQr)
      .catch(() => setQr(null));
  }, [show.linkVendas]);

  function onUpload(file: File) {
    if (file.size > 1_400_000) return toast.error("Imagem muito grande (máx ~1.4MB).");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setImgs((p) => [{ id: `local-${Date.now()}`, url }, ...p]);
      setBg(url);
      start(async () => {
        await addImagemDivulgacaoAction(url);
      });
    };
    reader.readAsDataURL(file);
  }

  function sortear() {
    if (imgs.length === 0) return toast.info("Sem fotos na galeria — envie uma.");
    setBg(imgs[Math.floor(Math.random() * imgs.length)].url);
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
      toast.error("Falha ao exportar. Se usou link de imagem externo, o site dela pode bloquear — envie a foto (Enviar foto).");
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
          ref={ref}
          className="relative overflow-hidden rounded-lg"
          style={{ width: W, height: H, background: bg ? "#000" : grad }}
        >
          {bg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full object-cover" />
          )}
          {/* Gradiente de legibilidade */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(9,9,11,0.96) 8%, rgba(9,9,11,0.55) 42%, transparent 75%)" }} />

          {/* Topo: banda */}
          <div className="absolute inset-x-0 top-0 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-400">Ao vivo</p>
            <p className="text-xl font-black leading-none text-zinc-100">{show.banda}</p>
          </div>

          {/* Tarja inferior */}
          <div className="absolute inset-x-0 bottom-0 m-3 rounded-lg border border-red-600 bg-zinc-950/90 p-3 backdrop-blur-sm">
            <p className="text-base font-bold text-zinc-100">{show.casaNome}</p>
            <p className="text-sm font-semibold text-amber-400">{show.dataLabel}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <div className="text-[11px] leading-tight text-zinc-300">
                {show.inicio && <p>Abertura: <span className="font-mono">{show.inicio}</span></p>}
                {show.termino && <p>Show: <span className="font-mono">{show.termino}</span></p>}
                {show.valorIngresso && <p className="text-amber-400">Ingresso: {show.valorIngresso}</p>}
              </div>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR" className="size-14 rounded bg-white p-0.5" />
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full gap-2">
          <Button onClick={baixar} disabled={downloading} className="flex-1">
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Baixar {aspect === "9:16" ? "Stories (9:16)" : "Feed (1:1)"}
          </Button>
        </div>
      </div>

      {/* Controles */}
      <div className="space-y-4">
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
              <p className="text-sm font-medium text-zinc-100">Fundo do cartaz</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={sortear}>
                  <Shuffle className="size-4" /> Sortear
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Enviar foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            {/* Gradientes (sem foto) */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBg(null)}
                className={cn("size-12 rounded-md border", !bg ? "border-primary" : "border-zinc-700")}
                style={{ background: grad }}
                title="Sem foto (gradiente)"
              />
              {GRADIENTES.map((g) => (
                <button
                  key={g}
                  onClick={() => { setGrad(g); setBg(null); }}
                  className="size-12 rounded-md border border-zinc-700"
                  style={{ background: g }}
                />
              ))}
            </div>

            {/* Galeria */}
            {imgs.length > 0 ? (
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
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <ImageIcon className="size-3.5" /> Envie fotos da banda ou do bar pra usar de fundo.
              </p>
            )}

            <p className="text-[11px] text-zinc-500">
              Dica: prefira <strong>Enviar foto</strong> (garante o download). Link de imagem externo às vezes é bloqueado pelo site de origem na hora de exportar.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
