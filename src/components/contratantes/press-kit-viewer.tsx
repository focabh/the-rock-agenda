"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ExternalLink, Loader2 } from "lucide-react";

// Worker do PDF.js via CDN (sem precisar copiar arquivo pro /public).
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PressKitViewer({
  src,
  fallbackHref,
}: {
  src: string;
  fallbackHref?: string;
}) {
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(0);
  const [err, setErr] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (err) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Não consegui exibir o press kit aqui.
        </p>
        {fallbackHref && (
          <a
            href={fallbackHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 font-medium hover:opacity-90"
          >
            <ExternalLink className="size-4" /> Abrir press kit
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden border border-border bg-white"
    >
      <Document
        file={src}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={() => setErr(true)}
        onSourceError={() => setErr(true)}
        loading={
          <div className="py-12 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin mr-2" /> Carregando press
            kit…
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={width || undefined}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="border-b border-border last:border-b-0"
          />
        ))}
      </Document>
    </div>
  );
}
