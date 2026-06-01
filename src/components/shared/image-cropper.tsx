"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  /** Data URL da imagem escolhida. Null = fechado. */
  src: string | null;
  /** Proporção largura/altura do recorte (1 = quadrado). */
  aspect?: number;
  /** Máscara redonda no preview (a imagem salva continua retangular). */
  round?: boolean;
  /** true (padrão): zoom mínimo já preenche o quadro (corta sobras). false:
   *  a imagem inteira cabe no quadro (bom pra logo larga/transparente). */
  cover?: boolean;
  /** Maior lado do resultado, em px. */
  outputSize?: number;
  format?: "jpeg" | "png";
  quality?: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

/** Enquadrar imagem: arraste pra posicionar e use o zoom; o recorte sai no
 *  tamanho/proporção pedidos. Sem dependências externas. */
export function ImageCropper({
  src,
  aspect = 1,
  round = false,
  cover = true,
  outputSize = 512,
  format = "jpeg",
  quality = 0.85,
  title = "Enquadrar imagem",
  onCancel,
  onConfirm,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Carrega a imagem (tamanho natural) sempre que a fonte muda.
  useEffect(() => {
    if (!src) {
      setNat(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
  }, [src]);

  const vp = () => {
    const el = viewportRef.current;
    return { w: el?.clientWidth ?? 1, h: el?.clientHeight ?? 1 };
  };
  const baseScale = () => {
    if (!nat) return 1;
    const { w, h } = vp();
    return cover ? Math.max(w / nat.w, h / nat.h) : Math.min(w / nat.w, h / nat.h);
  };
  const scale = () => baseScale() * zoom;
  const dispW = () => (nat ? nat.w * scale() : 0);
  const dispH = () => (nat ? nat.h * scale() : 0);

  function clamp(p: { x: number; y: number }) {
    const { w, h } = vp();
    const ax = (val: number, vpLen: number, dispLen: number) =>
      dispLen >= vpLen ? Math.min(0, Math.max(vpLen - dispLen, val)) : (vpLen - dispLen) / 2;
    return { x: ax(p.x, w, dispW()), y: ax(p.y, h, dispH()) };
  }

  // Centraliza ao carregar / mudar zoom inicial.
  useEffect(() => {
    if (!nat) return;
    const { w, h } = vp();
    setZoom(1);
    setPos({ x: (w - nat.w * baseScale()) / 2, y: (h - nat.h * baseScale()) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat]);

  function onZoom(z: number) {
    const { w, h } = vp();
    const old = baseScale() * zoom;
    const next = baseScale() * z;
    // Mantém o centro do viewport fixo durante o zoom.
    const cx = (w / 2 - pos.x) / old;
    const cy = (h / 2 - pos.y) / old;
    const np = { x: w / 2 - cx * next, y: h / 2 - cy * next };
    setZoom(z);
    setPos(clamp(np));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.px + (e.clientX - drag.current.x);
    const ny = drag.current.py + (e.clientY - drag.current.y);
    setPos(clamp({ x: nx, y: ny }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function confirm() {
    if (!nat || !imgRef.current) return;
    const { w, h } = vp();
    const s = scale();
    const srcX = -pos.x / s;
    const srcY = -pos.y / s;
    const srcW = w / s;
    const srcH = h / s;
    const outW = outputSize;
    const outH = Math.round(outputSize / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    const url =
      format === "png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
    onConfirm(url);
  }

  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Arraste pra posicionar e use o zoom. Depois é só confirmar.</DialogDescription>
        </DialogHeader>

        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative mx-auto w-full max-w-sm touch-none overflow-hidden bg-zinc-900 select-none ${
            round ? "rounded-full" : "rounded-lg"
          }`}
          style={{ aspectRatio: String(aspect), cursor: drag.current ? "grabbing" : "grab" }}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 max-w-none select-none"
              style={{
                width: dispW(),
                height: dispH(),
                transform: `translate(${pos.x}px, ${pos.y}px)`,
              }}
            />
          )}
          {/* moldura sutil */}
          <div className={`pointer-events-none absolute inset-0 ring-1 ring-white/20 ${round ? "rounded-full" : "rounded-lg"}`} />
        </div>

        <div className="flex items-center gap-3 px-1">
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-primary"
            aria-label="Zoom"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="size-4" /> Cancelar
          </Button>
          <Button onClick={confirm} disabled={!nat}>
            <Check className="size-4" /> Usar foto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
