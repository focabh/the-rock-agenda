"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";

type Picked = {
  endereco: string;
  cidade: string;
  bairro: string;
  estado: string;
  lat: string;
  lon: string;
};

type Suggestion = { placeId: string; text: string };

export function AddressAutocomplete({
  label = "Endereço",
  defaultValue = "",
  defaults,
}: {
  label?: string;
  defaultValue?: string;
  defaults?: Partial<Picked>;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [picked, setPicked] = useState<Picked>({
    endereco: defaultValue,
    cidade: defaults?.cidade ?? "",
    bairro: defaults?.bairro ?? "",
    estado: defaults?.estado ?? "",
    lat: defaults?.lat ?? "",
    lon: defaults?.lon ?? "",
  });
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skip = useRef(false);
  // Não dispara busca na montagem (endereço pré-preenchido na edição) — só
  // quando o usuário realmente digitar. Evita request/abertura ao abrir a tela.
  const firstRun = useRef(true);
  const coords = useRef<{ lat: number; lon: number } | null>(null);

  // Pede a localização do device pra priorizar resultados perto de quem usa.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coords.current = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
      );
    }
  }, []);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (coords.current) {
          params.set("lat", String(coords.current.lat));
          params.set("lon", String(coords.current.lon));
        }
        const res = await fetch(`/api/places/autocomplete?${params.toString()}`);
        const data = await res.json();
        setResults(Array.isArray(data?.suggestions) ? data.suggestions : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function choose(s: Suggestion) {
    skip.current = true;
    setQuery(s.text);
    setOpen(false);
    setResults([]);
    try {
      const res = await fetch(
        `/api/places/details?id=${encodeURIComponent(s.placeId)}`
      );
      const d = await res.json();
      setPicked({
        endereco: d.endereco || s.text,
        cidade: d.cidade ?? "",
        bairro: d.bairro ?? "",
        estado: d.estado ?? "",
        lat: d.lat ?? "",
        lon: d.lon ?? "",
      });
      if (d.endereco) {
        skip.current = true;
        setQuery(d.endereco);
      }
    } catch {
      setPicked((p) => ({ ...p, endereco: s.text }));
    }
  }

  return (
    <div className="relative space-y-2">
      <Label htmlFor="endereco">{label}</Label>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          id="endereco"
          name="endereco"
          value={query}
          autoComplete="off"
          placeholder="Digite a rua, número ou nome do local..."
          className="pl-8"
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked((p) => ({ ...p, endereco: e.target.value }));
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-md">
          {results.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent/60"
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        {picked.cidade || picked.estado
          ? `${picked.cidade}${picked.estado ? " - " + picked.estado : ""}`
          : "Busca de endereço (Google) — prioriza onde você está"}
      </p>
      <input type="hidden" name="cidade" value={picked.cidade} />
      <input type="hidden" name="bairro" value={picked.bairro} />
      <input type="hidden" name="estado" value={picked.estado} />
      <input type="hidden" name="latitude" value={picked.lat} />
      <input type="hidden" name="longitude" value={picked.lon} />
    </div>
  );
}
