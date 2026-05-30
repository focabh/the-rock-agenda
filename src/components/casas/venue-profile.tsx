"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, X, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ALL_VENUE_TAGS } from "@/lib/venue-tags";
import {
  setVenueProfileAction,
  analyzeVenueAction,
} from "@/app/(app)/casas/contact-actions";

export function VenueProfile({
  venueId,
  initialTags,
  initialPerfil,
  admin,
}: {
  venueId: string;
  initialTags: string[];
  initialPerfil: string;
  admin: boolean;
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [perfil, setPerfil] = useState(initialPerfil);
  const [custom, setCustom] = useState("");
  const [saving, startSave] = useTransition();
  const [analyzing, startAnalyze] = useTransition();

  // Visão do músico (não-admin): só leitura.
  if (!admin) {
    if (tags.length === 0 && !perfil) return null;
    return (
      <Card className="p-4 space-y-3">
        <p className="text-sm font-medium">Perfil da casa</p>
        {perfil && <p className="text-sm text-muted-foreground">{perfil}</p>}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-accent px-2.5 py-1 text-xs text-foreground/80"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </Card>
    );
  }

  function toggle(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }
  function addCustom() {
    const c = custom.trim();
    if (c && !tags.includes(c)) setTags((t) => [...t, c]);
    setCustom("");
  }
  function save() {
    startSave(async () => {
      await setVenueProfileAction(venueId, {
        caracteristicas: tags,
        perfilPublico: perfil,
      });
      toast.success("Perfil da casa salvo.");
    });
  }
  function analyze() {
    startAnalyze(async () => {
      const r = await analyzeVenueAction(venueId);
      if (!r.ok || !r.suggestion) {
        if (r.needsKey) toast.info(r.error ?? "IA não configurada.");
        else toast.error(r.error ?? "Falha na análise.");
        return;
      }
      setTags((t) => [...new Set([...t, ...r.suggestion!.caracteristicas])]);
      if (r.suggestion.perfilPublico) setPerfil(r.suggestion.perfilPublico);
      toast.success("Sugestão da IA aplicada — revise e salve.");
    });
  }

  const sugestoes = ALL_VENUE_TAGS.filter((t) => !tags.includes(t));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Perfil & características da casa</p>
        <Button
          variant="outline"
          size="sm"
          onClick={analyze}
          disabled={analyzing}
          title="Analisar perfil da casa com IA (busca na web)"
        >
          {analyzing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {analyzing ? "Analisando…" : "Analisar com IA"}
        </Button>
      </div>

      {/* Tags selecionadas */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/40"
            >
              {t}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}

      {/* Sugestões pra adicionar */}
      <div className="flex flex-wrap gap-1.5">
        {sugestoes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-inset ring-border hover:bg-accent/50"
          >
            <Plus className="size-3" />
            {t}
          </button>
        ))}
      </div>

      {/* Custom */}
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Característica personalizada…"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          className="h-8"
        />
        <Button variant="outline" size="sm" onClick={addCustom} disabled={!custom.trim()}>
          Add
        </Button>
      </div>

      {/* Perfil de público */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          Perfil do público (resumo)
        </label>
        <Textarea
          value={perfil}
          onChange={(e) => setPerfil(e.target.value)}
          rows={3}
          placeholder="Ex.: público 30+, curte rock clássico e alternativo, ambiente de bar…"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar perfil
        </Button>
      </div>
    </Card>
  );
}
