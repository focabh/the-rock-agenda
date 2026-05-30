"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { maskPhone } from "@/lib/validators";

/**
 * Campo de telefone que aplica a máscara (DDD) ao digitar E ao colar — o
 * onChange dispara depois do paste, então maskPhone formata em ambos os casos.
 * A máscara também é aplicada no valor inicial (telefone já cadastrado).
 */
export function PhoneInput({
  id,
  name,
  defaultValue = "",
  placeholder = "(31) 99999-9999",
  className,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(() => maskPhone(defaultValue));
  return (
    <Input
      id={id}
      name={name}
      value={value}
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder}
      className={className}
      onChange={(e) => setValue(maskPhone(e.target.value))}
    />
  );
}
