"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/formatters";

export type ContratoData = {
  showId: string;
  bandName: string;
  logoUrl: string | null;
  casa: string;
  contatoNome: string | null;
  contatoTelefone: string | null;
  local: string;
  cidadeUf: string;
  dataExtensa: string;
  inicio: string | null;
  termino: string | null;
  cacheCentavos: number;
  privado: boolean;
};

export function ContratoView({ data }: { data: ContratoData }) {
  const [tipo, setTipo] = useState<"contrato" | "recibo">("contrato");
  const cache = formatBRL(data.cacheCentavos);
  const horario = data.inicio ? `${data.inicio}${data.termino ? ` às ${data.termino}` : ""}` : "a combinar";

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      {/* Barra de ações — some na impressão */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="outline" size="sm" render={<Link href={`/shows/${data.showId}`} />}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-full ring-1 ring-border">
            <button
              onClick={() => setTipo("contrato")}
              className={`px-3 py-1.5 text-sm font-semibold ${tipo === "contrato" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Contrato
            </button>
            <button
              onClick={() => setTipo("recibo")}
              className={`px-3 py-1.5 text-sm font-semibold ${tipo === "recibo" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Recibo
            </button>
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Salvar PDF / Imprimir
          </Button>
        </div>
      </div>

      {/* Documento (fundo branco, tinta preta — bom pra papel/PDF) */}
      <div
        id="doc"
        className="rounded-lg bg-white p-8 text-zinc-900 shadow-sm ring-1 ring-zinc-200 print:rounded-none print:shadow-none print:ring-0 sm:p-12"
      >
        <header className="mb-8 flex items-center gap-4 border-b border-zinc-200 pb-6">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt={data.bandName} className="size-16 shrink-0 object-contain" />
          ) : null}
          <div>
            <h1 className="text-2xl font-black tracking-tight">{data.bandName}</h1>
            <p className="text-sm text-zinc-500">
              {tipo === "contrato" ? "Contrato de apresentação musical" : "Recibo de pagamento"}
            </p>
          </div>
        </header>

        {tipo === "contrato" ? (
          <div className="space-y-5 text-[15px] leading-relaxed">
            <p>
              Pelo presente instrumento, de um lado <strong>{data.bandName}</strong> (doravante
              <strong> CONTRATADA</strong>) e, de outro, <strong>{data.casa}</strong>
              {data.contatoNome ? `, representado(a) por ${data.contatoNome}` : ""} (doravante
              <strong> CONTRATANTE</strong>), ajustam a presente apresentação musical, nos termos abaixo.
            </p>

            <Section titulo="1. Objeto">
              Apresentação musical da CONTRATADA no dia <strong>{data.dataExtensa}</strong>, com horário{" "}
              <strong>{horario}</strong>, no local <strong>{data.local}</strong>
              {data.cidadeUf ? `, ${data.cidadeUf}` : ""}.
            </Section>

            <Section titulo="2. Cachê e pagamento">
              Pela apresentação, a CONTRATANTE pagará à CONTRATADA o valor de{" "}
              <strong>{cache}</strong>, na forma e prazo combinados entre as partes
              (à vista no dia do evento, salvo acordo diverso por escrito).
            </Section>

            <Section titulo="3. Estrutura e responsabilidades">
              A CONTRATANTE disponibilizará espaço adequado, energia elétrica estável e
              segurança no local. A CONTRATADA se responsabiliza por seus instrumentos e
              pela execução do repertório no horário combinado.
            </Section>

            <Section titulo="4. Cancelamento">
              O cancelamento por qualquer das partes deverá ser comunicado com a maior
              antecedência possível. Cancelamentos de última hora pela CONTRATANTE podem
              ensejar o pagamento de parte do cachê, conforme acordo entre as partes.
            </Section>

            <Section titulo="5. Foro">
              As partes elegem o foro da comarca do local do evento para dirimir eventuais
              dúvidas oriundas deste contrato.
            </Section>
          </div>
        ) : (
          <div className="space-y-6 text-[15px] leading-relaxed">
            <p className="text-2xl font-bold">
              Recebi {cache}
            </p>
            <p>
              Recebi de <strong>{data.casa}</strong>
              {data.contatoNome ? ` (${data.contatoNome})` : ""} a importância de{" "}
              <strong>{cache}</strong>, referente à apresentação musical de{" "}
              <strong>{data.bandName}</strong> realizada em <strong>{data.dataExtensa}</strong>
              {data.local ? `, no(a) ${data.local}` : ""}
              {data.cidadeUf ? `, ${data.cidadeUf}` : ""}.
            </p>
            <p>
              Para clareza e devidos fins, firmo o presente recibo, dando plena e
              total quitação do valor referente a esta apresentação.
            </p>
          </div>
        )}

        {/* Assinaturas */}
        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2">
          <Assinatura titulo={data.bandName} legenda="CONTRATADA" />
          <Assinatura titulo={data.casa} legenda="CONTRATANTE" />
        </div>

        <p className="mt-10 text-center text-xs text-zinc-400">
          Documento gerado pelo StageBoss · {data.bandName}
        </p>
      </div>

      {/* Regras de impressão: esconde tudo do app, mostra só o documento */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #doc, #doc * { visibility: visible !important; }
          #doc { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 font-bold">{titulo}</h2>
      <p>{children}</p>
    </div>
  );
}

function Assinatura({ titulo, legenda }: { titulo: string; legenda: string }) {
  return (
    <div className="text-center">
      <div className="mb-1 border-t border-zinc-400 pt-2 text-sm font-semibold">{titulo}</div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{legenda}</div>
      <div className="mt-1 text-xs text-zinc-400">Data: ___/___/______</div>
    </div>
  );
}
