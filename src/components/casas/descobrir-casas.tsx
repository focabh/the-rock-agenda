"use client";

import { useEffect, useState, useTransition } from "react";
import { MapPin, Search, Plus, Check, Loader2, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  descobrirCasasAction,
  adicionarCasaDescobertaAction,
} from "@/app/(app)/casas/actions";
import type { CasaCandidata } from "@/lib/venue-places";

const BH = { lat: -19.9191, lng: -43.9386 };

export function DescobrirCasas() {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(BH);
  const [temGeo, setTemGeo] = useState(false);
  const [termo, setTermo] = useState("bar com música ao vivo, rock, pub, casa de shows");
  const [raioKm, setRaioKm] = useState(8);
  const [buscando, startBuscar] = useTransition();
  const [resultados, setResultados] = useState<CasaCandidata[] | null>(null);
  const [jaCad, setJaCad] = useState<Set<string>>(new Set());
  const [adicionadas, setAdicionadas] = useState<Set<string>>(new Set());
  const [addPend, startAdd] = useTransition();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setTemGeo(true);
      },
      () => {},
      { timeout: 8000 }
    );
  }, []);

  function buscar() {
    if (!termo.trim()) return toast.error("Descreva o tipo de casa (perfil da banda).");
    startBuscar(async () => {
      const r = await descobrirCasasAction({ lat: coords.lat, lng: coords.lng, raioM: raioKm * 1000, termo: termo.trim() });
      setJaCad(new Set(r.jaCadastradas));
      setResultados(r.candidatas);
      if (r.candidatas.length === 0) toast.info("Nada encontrado por aqui. Tente outro termo ou raio maior.");
    });
  }

  function adicionar(c: CasaCandidata) {
    startAdd(async () => {
      const r = await adicionarCasaDescobertaAction(c);
      if (r.ok) {
        setAdicionadas((s) => new Set(s).add(c.nome.toLowerCase()));
        toast.success(`"${c.nome}" adicionada às casas.`);
      } else {
        toast.error("Não consegui adicionar.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-[#18181b]">
        <CardContent className="space-y-3 py-4">
          <div className="space-y-1">
            <Label className="text-[11px] text-zinc-400">Perfil da casa (o que combina com a banda)</Label>
            <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="ex.: rock, música ao vivo, pub…" className="bg-[#0f0f11]" />
            <p className="text-[11px] text-zinc-500">Use palavras do estilo de vocês (rock, ao vivo, pub). Assim não vem casa de pagode. 😉</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-zinc-400">Raio · {raioKm} km {temGeo ? "(da sua localização)" : "(de BH — permita a localização p/ usar a sua)"}</Label>
            <input type="range" min={1} max={50} value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))} className="w-full accent-red-600" />
          </div>
          <Button onClick={buscar} disabled={buscando} className="bg-red-600 hover:bg-red-700">
            {buscando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Descobrir casas
          </Button>
          <p className="text-[11px] text-zinc-500">Usa o Google Places (crédito gratuito do Google; uso leve não custa nada).</p>
        </CardContent>
      </Card>

      {resultados && (
        <div className="grid gap-3 md:grid-cols-2">
          {resultados.map((c, i) => {
            const key = c.nome.toLowerCase();
            const existe = jaCad.has(key);
            const add = adicionadas.has(key);
            return (
              <Card key={i} className="border-zinc-800 bg-[#18181b]">
                <CardContent className="flex items-start gap-3 py-4">
                  {c.logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logoDataUrl} alt="" className="size-12 shrink-0 rounded-md object-cover ring-1 ring-zinc-700" />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700">
                      <MapPin className="size-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-zinc-100">{c.nome}</h3>
                    {c.categoria && <p className="text-xs text-zinc-400">{c.categoria}</p>}
                    {c.endereco && (
                      <p className="mt-0.5 flex items-start gap-1 text-sm text-zinc-400">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" /> {c.endereco}
                      </p>
                    )}
                    {c.instagram && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-zinc-300">
                        <AtSign className="size-3" /> {c.instagram}
                      </p>
                    )}
                  </div>
                  {existe ? (
                    <span className="shrink-0 rounded-full px-2 py-1 text-[11px] text-zinc-500 ring-1 ring-inset ring-zinc-700">já tem</span>
                  ) : add ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                      <Check className="size-3" /> Adicionada
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={addPend} onClick={() => adicionar(c)} className="shrink-0">
                      <Plus className="size-4" /> Adicionar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {resultados.length === 0 && (
            <p className={cn("text-sm text-zinc-400")}>Nenhuma casa encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
