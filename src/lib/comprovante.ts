/** Valor sentinela em `gastos.comprovante` (que é NOT NULL) para lançamentos
 *  IMPORTADOS de relatório, que não têm comprovante. A UI mostra "importado —
 *  sem comprovante" em vez de tentar renderizar como imagem/PDF. */
export const IMPORTED_NO_RECEIPT = "importado:sem-comprovante";

/** Comprovante "de verdade" é sempre um data URL; o resto é marcador/import. */
export function isRealComprovante(value: string | null | undefined): boolean {
  return !!value && value.startsWith("data:");
}
