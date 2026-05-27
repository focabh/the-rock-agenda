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

type PhotonFeature = {
  properties: Record<string, string | number | undefined>;
  geometry?: { coordinates?: [number, number] };
};

// Centro de Belo Horizonte — usado pra priorizar resultados locais.
const BH = { lat: -19.9191, lon: -43.9386 };

function str(v: string | number | undefined): string {
  return v == null ? "" : String(v);
}

function partsOf(f: PhotonFeature) {
  const p = f.properties;
  const street = str(p.street) || str(p.name);
  const num = str(p.housenumber);
  const bairro =
    str(p.district) || str(p.suburb) || str(p.neighbourhood) || str(p.locality);
  const cidade = str(p.city) || str(p.town) || str(p.village) || str(p.county);
  const estado = str(p.state);
  return { street, num, bairro, cidade, estado };
}

function label(f: PhotonFeature): string {
  const { street, num, bairro, cidade, estado } = partsOf(f);
  const arr = [
    [street, num].filter(Boolean).join(", "),
    bairro,
    cidade,
    estado,
  ].filter(Boolean);
  return arr.join(" - ") || str(f.properties.name);
}

export function AddressAutocomplete({
  label: fieldLabel = "Endereço",
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
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skip = useRef(false);

  useEffect(() => {
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
        const url =
          "https://photon.komoot.io/api/?limit=8" +
          `&lat=${BH.lat}&lon=${BH.lon}` +
          "&q=" +
          encodeURIComponent(q);
        const res = await fetch(url);
        const data = await res.json();
        const feats: PhotonFeature[] = Array.isArray(data?.features)
          ? data.features
          : [];
        // só Brasil
        const br = feats.filter(
          (f) => str(f.properties.countrycode).toUpperCase() === "BR"
        );
        setResults(br.length ? br : feats);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  function choose(f: PhotonFeature) {
    const { bairro, cidade, estado } = partsOf(f);
    const endereco = label(f);
    const coords = f.geometry?.coordinates;
    skip.current = true;
    setQuery(endereco);
    setPicked({
      endereco,
      cidade,
      bairro,
      estado,
      lat: coords ? String(coords[1]) : "",
      lon: coords ? String(coords[0]) : "",
    });
    setOpen(false);
    setResults([]);
  }

  return (
    <div className="relative space-y-2">
      <Label htmlFor="endereco">{fieldLabel}</Label>
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
          {results.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(f);
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent/60"
              >
                {label(f)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        {picked.cidade || picked.estado
          ? `${picked.cidade}${picked.estado ? " - " + picked.estado : ""}`
          : "Busca de endereço (OpenStreetMap/Photon)"}
      </p>
      <input type="hidden" name="cidade" value={picked.cidade} />
      <input type="hidden" name="bairro" value={picked.bairro} />
      <input type="hidden" name="estado" value={picked.estado} />
      <input type="hidden" name="latitude" value={picked.lat} />
      <input type="hidden" name="longitude" value={picked.lon} />
    </div>
  );
}
