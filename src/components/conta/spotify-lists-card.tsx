"use client";

import { useState, useTransition } from "react";
import { Music, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSpotifyListsAction } from "@/app/(app)/conta/actions";
import { toast } from "sonner";

/** Listas do Spotify fixas por contexto — pré-preenchem o import e ficam gravadas. */
export function SpotifyListsCard({
  repertorio,
  setlist,
  ensaio,
}: {
  repertorio: string;
  setlist: string;
  ensaio: string;
}) {
  const [rep, setRep] = useState(repertorio);
  const [set, setSet] = useState(setlist);
  const [ens, setEns] = useState(ensaio);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function salvar() {
    start(async () => {
      const r = await setSpotifyListsAction(rep, set, ens);
      if (r.ok) {
        toast.success("Listas do Spotify salvas.");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  const field = (label: string, hint: string, val: string, setVal: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="https://open.spotify.com/playlist/..."
        inputMode="url"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/20 shrink-0">
            <Music className="size-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold">Listas do Spotify</h3>
            <p className="text-sm text-muted-foreground">
              Deixe as playlists gravadas por contexto. No “Importar do Spotify”, o
              link já vem preenchido — é só importar.
            </p>
          </div>
        </div>

        {field("Repertório", "Playlist geral da banda (importar músicas pro repertório).", rep, setRep)}
        {field("Shows (setlist)", "Playlist base pros setlists de show.", set, setSet)}
        {field("Ensaios", "Playlist base pros setlists de ensaio.", ens, setEns)}

        <div className="flex items-center justify-end gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
              <Check className="size-3.5" /> salvo
            </span>
          )}
          <Button onClick={salvar} disabled={pending}>
            {pending ? "Salvando…" : "Salvar listas"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
