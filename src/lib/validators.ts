// Posições fixas da banda (1 de cada). O valor casa com members.funcao.
export const POSICOES = [
  "Vocal",
  "Guitarra Solo",
  "Guitarra Base",
  "Baixo",
  "Bateria",
  "Manager",
] as const;

export type Posicao = (typeof POSICOES)[number];

export const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");

export function cpfValido(input: string): boolean {
  const c = onlyDigits(input);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(c[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(c[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

export function telefoneValido(input: string): boolean {
  const d = onlyDigits(input);
  return d.length === 10 || d.length === 11;
}

/**
 * Valida o FORMATO de uma chave PIX (não a existência real no banco):
 * email, CPF, telefone (DDD+número, com ou sem +55) ou chave aleatória (EVP).
 */
export function pixValido(input: string): boolean {
  const k = (input ?? "").trim();
  if (!k) return false;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k)) return true; // email
  if (cpfValido(k)) return true; // CPF
  const d = onlyDigits(k);
  if (/^\+?55?\d{10,11}$/.test(k.replace(/[\s()-]/g, "")) || d.length === 10 || d.length === 11)
    return true; // telefone
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return true; // EVP uuid
  if (/^[0-9a-f]{32}$/i.test(k)) return true; // EVP 32 hex
  return false;
}

export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
