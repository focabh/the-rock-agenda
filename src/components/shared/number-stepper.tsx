"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Campo numérico com setinhas −/+ (consistente com a UI). Permite digitar
 * livremente (inclusive limpar) e clampa no blur. Opcional `name` pra submit
 * em forms. Resolve o bug do "6" preso (não força default no meio da edição).
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 5,
  id,
  name,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  name?: string;
  className?: string;
}) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className={cn("inline-flex items-stretch", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-r-none"
        onClick={() => onChange(clamp(value - step))}
        aria-label="Diminuir"
      >
        <Minus className="size-4" />
      </Button>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={txt}
        onChange={(e) => {
          setTxt(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(clamp(n));
        }}
        onBlur={() => {
          const n = Number(txt);
          const c = txt === "" || !Number.isFinite(n) ? value : clamp(n);
          setTxt(String(c));
          onChange(c);
        }}
        className="h-9 w-16 border-y border-input bg-transparent px-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-l-none"
        onClick={() => onChange(clamp(value + step))}
        aria-label="Aumentar"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
