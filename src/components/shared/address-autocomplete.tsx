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

type OsmResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

function uf(r: OsmResult): string {
  const iso = r.address?.["ISO3166-2-lvl4"];
  if (iso && iso.includes("-")) return iso.split("-")[1];
  return r.address?.state ?? "";
}

function format(r: OsmResult): string {
  const a = r.address ?? {};
  const parts = [
    [a.road, a.house_number].filter(Boolean).join(", "),
    a.suburb || a.neighbourhood || a.quarter,
    a.city || a.town || a.village || a.municipality,
    uf(r),
  ].filter(Boolean);
  return parts.join(" - ") || r.display_name;
}

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
  const [results, setResults] = useState<OsmResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 4) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=br&limit=6&q=" +
          encodeURIComponent(q);
        const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query]);

  function choose(r: OsmResult) {
    const a = r.address ?? {};
    const endereco = format(r);
    skip.current = true;
    setQuery(endereco);
    setPicked({
      endereco,
      cidade: a.city || a.town || a.village || a.municipality || "",
      bairro: a.suburb || a.neighbourhood || a.quarter || "",
      estado: uf(r),
      lat: r.lat ?? "",
      lon: r.lon ?? "",
    });
    setOpen(false);
    setResults([]);
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
          placeholder="Digite a rua e escolha na lista..."
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
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent/60"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        {picked.cidade || picked.estado
          ? `${picked.cidade}${picked.estado ? " - " + picked.estado : ""}`
          : "Busca via OpenStreetMap"}
      </p>
      <input type="hidden" name="cidade" value={picked.cidade} />
      <input type="hidden" name="bairro" value={picked.bairro} />
      <input type="hidden" name="estado" value={picked.estado} />
      <input type="hidden" name="latitude" value={picked.lat} />
      <input type="hidden" name="longitude" value={picked.lon} />
    </div>
  );
}
