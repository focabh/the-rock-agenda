"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Link2, ClipboardPaste, Loader2, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  fetchAndParseIcsAction,
  importAgendaAction,
  type ParsedEventDTO,
  type ImportItem,
} from "@/app/(app)/agenda/import-actions";

type Choice = "show" | "ensaio" | "skip";

function fmt(iso: string | null, time: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  return time ? `${data} · ${time}` : data;
}

export function IcsImporter() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [events, setEvents] = useState<ParsedEventDTO[] | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [analyzing, startAnalyze] = useTransition();
  const [importing, startImport] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function analyze(payload: { url?: string; text?: string }) {
    startAnalyze(async () => {
      const r = await fetchAndParseIcsAction(payload);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.events.length === 0) {
        toast.info("Nenhum evento futuro encontrado.");
        return;
      }
      setEvents(r.events);
      setChoices(r.events.map((e) => e.suggested));
      toast.success(`${r.events.length} evento(s) futuro(s) encontrado(s).`);
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => analyze({ text: String(reader.result || "") });
    reader.readAsText(file);
  }

  function doImport() {
    if (!events) return;
    const items: ImportItem[] = events
      .map((e, i): ImportItem | null => {
        if (!e.startISO) return null;
        return {
          type: choices[i],
          summary: e.summary,
          location: e.location,
          description: e.description,
          startISO: e.startISO,
          startTime: e.startTime,
        };
      })
      .filter((x): x is ImportItem => x !== null && x.type !== "skip");

    if (items.length === 0) {
      toast.error("Marque ao menos um evento como Show ou Ensaio.");
      return;
    }
    startImport(async () => {
      const r = await importAgendaAction(items);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Importado: ${r.shows} show(s), ${r.ensaios} ensaio(s)` +
          (r.casasCriadas ? `, ${r.casasCriadas} casa(s) nova(s)` : "") + "."
      );
      router.push("/agenda");
      router.refresh();
    });
  }

  const count = choices.filter((c) => c !== "skip").length;

  return (
    <div className="space-y-6">
      {!events ? (
        <Card>
          <CardContent className="space-y-5 py-5">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
                <Upload className="size-4" /> Arquivo .ics
              </p>
              <input ref={fileRef} type="file" accept=".ics,text/calendar" onChange={onFile} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={analyzing}>
                Escolher arquivo .ics
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">Exporte do Google/Apple/Outlook e suba aqui.</p>
            </div>

            <div>
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
                <Link2 className="size-4" /> URL iCal (endereço secreto do Google Agenda)
              </p>
              <div className="flex gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/.../basic.ics" />
                <Button variant="outline" onClick={() => analyze({ url })} disabled={analyzing || !url.trim()}>
                  {analyzing ? <Loader2 className="size-4 animate-spin" /> : "Analisar"}
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
                <ClipboardPaste className="size-4" /> Colar conteúdo .ics
              </p>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="BEGIN:VCALENDAR…" className="font-mono text-xs" />
              <Button variant="outline" size="sm" className="mt-2" onClick={() => analyze({ text })} disabled={analyzing || !text.trim()}>
                {analyzing ? <Loader2 className="size-4 animate-spin" /> : "Analisar texto"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {events.length} evento(s). Marque o que vira <strong>Show</strong>,{" "}
              <strong>Ensaio</strong> ou <strong>Ignorar</strong>.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setEvents(null)}>
              Recomeçar
            </Button>
          </div>

          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {events.map((e, i) => (
                <li key={i} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(e.startISO, e.startTime)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(["show", "ensaio", "skip"] as Choice[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChoices((cs) => cs.map((x, j) => (j === i ? c : x)))}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                          choices[i] === c
                            ? c === "skip"
                              ? "bg-muted text-muted-foreground ring-border"
                              : "bg-primary/20 text-primary ring-primary/40"
                            : "text-muted-foreground ring-border hover:bg-accent/50"
                        )}
                      >
                        {c === "show" ? "Show" : c === "ensaio" ? "Ensaio" : "Ignorar"}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex justify-end">
            <Button onClick={doImport} disabled={importing || count === 0}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
              Importar {count} evento(s)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
