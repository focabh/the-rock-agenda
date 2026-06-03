// Gera o "Pix Copia e Cola" (BR Code / EMV MPM) — padrão do Banco Central.
// Função pura, sem API: monta o payload e o CRC16. O app gera o QR a partir
// dessa string (lib qrcode no cliente). Sem custo, sem token.

export type PixTipo = "CPF" | "CNPJ" | "E-mail" | "Telefone" | "Aleatória" | string | null;

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — exigido no campo 63 do BR Code. */
function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Campo EMV: ID (2) + tamanho (2, zero-pad) + valor. */
function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

/** Remove acentos/ças, mantém ASCII imprimível, MAIÚSCULAS, corta no limite. */
function ascii(s: string, max: number): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max);
}

/** Normaliza a chave conforme o tipo (dígitos p/ CPF/CNPJ, +55 p/ telefone…). */
export function normalizarChavePix(chave: string, tipo: PixTipo): string {
  const c = (chave || "").trim();
  switch (tipo) {
    case "CPF":
    case "CNPJ":
      return c.replace(/\D/g, "");
    case "Telefone": {
      const d = c.replace(/\D/g, "").replace(/^55/, "");
      return "+55" + d;
    }
    case "E-mail":
      return c.toLowerCase();
    default:
      return c; // Aleatória (EVP) ou desconhecido: usa como está
  }
}

/** Monta o Pix Copia-e-Cola. valorCentavos=0 → QR sem valor (paga-se o que quiser). */
export function gerarPixCopiaECola(opts: {
  chave: string;
  tipo: PixTipo;
  nome: string;
  valorCentavos: number;
  cidade?: string;
  txid?: string;
}): string {
  const key = normalizarChavePix(opts.chave, opts.tipo);
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const nome = ascii(opts.nome, 25) || "RECEBEDOR";
  const cidade = ascii(opts.cidade || "BRASIL", 15) || "BRASIL";
  const txid = ascii(opts.txid || "***", 25) || "***";

  let payload =
    tlv("00", "01") + // payload format indicator
    tlv("26", mai) + // merchant account info (Pix)
    tlv("52", "0000") + // merchant category code
    tlv("53", "986") + // moeda BRL
    (opts.valorCentavos > 0 ? tlv("54", (opts.valorCentavos / 100).toFixed(2)) : "") +
    tlv("58", "BR") + // país
    tlv("59", nome) + // recebedor
    tlv("60", cidade) + // cidade
    tlv("62", tlv("05", txid)); // dados adicionais (txid)

  payload += "6304"; // campo CRC + tamanho
  return payload + crc16(payload);
}
