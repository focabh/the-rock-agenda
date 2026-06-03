import { asc } from "drizzle-orm";
import { db } from "@/db";
import { equipamentos, appSettings } from "@/db/schema";
import { requireCurrentUser } from "@/lib/auth";
import { RiderActions } from "@/components/equipamentos/rider-actions";

// O que a casa/evento precisa fornecer ou confirmar (estrutura enxuta da banda).
const CASA_FORNECE = [
  "PA principal adequado ao espaço",
  "Técnico de som, quando houver estrutura da casa",
  "Pedestais de microfone",
  "Cabos XLR e P10 extras",
  "Pratos, ferragens, banco e pedal de bumbo",
  "Microfones para a bateria, se for microfonada",
  "DI para o baixo, caso necessário",
  "Energia elétrica estável próxima ao palco",
];

// Input list pra mesa de 8 canais.
const INPUT_PEQUENO = ["Vocal principal", "Backing vocal", "Guitarra", "Baixo", "Bumbo", "Overhead bateria"];
const INPUT_CHEIO = ["Vocal principal", "Backing vocal", "Guitarra 1", "Guitarra 2", "Baixo", "Bumbo", "Caixa", "Overhead bateria"];

export default async function RiderPage() {
  await requireCurrentUser();
  const [rows, settings] = await Promise.all([
    db.select().from(equipamentos).orderBy(asc(equipamentos.nome)),
    db.select({ bandName: appSettings.bandName }).from(appSettings).limit(1),
  ]);
  const banda = settings[0]?.bandName?.trim() || "The Rock";

  const proprios = rows.map((e) => `${e.nome}${e.especificacoes ? ` — ${e.especificacoes}` : ""}`);

  // Texto plano pro WhatsApp / cópia.
  const texto =
    `RIDER TÉCNICO — ${banda}\n\n` +
    `EQUIPAMENTO PRÓPRIO DA BANDA\n` +
    proprios.map((p) => `- ${p}`).join("\n") +
    `\n- Instrumentos e pedais próprios dos músicos\n\n` +
    `A CASA/EVENTO PRECISA FORNECER OU CONFIRMAR\n` +
    CASA_FORNECE.map((p) => `- ${p}`).join("\n") +
    `\n\nINPUT LIST (mesa de 8 canais)\n` +
    `Show pequeno:\n` +
    INPUT_PEQUENO.map((p, i) => `${i + 1}. ${p}`).join("\n") +
    `\n\nSetup cheio (com 2 guitarras):\n` +
    INPUT_CHEIO.map((p, i) => `${i + 1}. ${p}`).join("\n") +
    `\n\nEstrutura enxuta — ideal pra ensaio, festa pequena, sítio e eventos pequenos.`;

  const Sec = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">{titulo}</h2>
      {children}
    </section>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto max-w-2xl px-6 py-8 print:py-4">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-400">Rider Técnico</p>
            <h1 className="text-2xl font-bold">{banda}</h1>
            <p className="mt-1 text-xs text-zinc-500">Estrutura enxuta — ensaio, festa pequena, sítio e eventos pequenos.</p>
          </div>
          <RiderActions texto={texto} />
        </div>

        <div className="space-y-6">
          <Sec titulo="Equipamento próprio da banda">
            <ul className="space-y-1">
              {rows.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 border-b border-zinc-800/60 py-1.5">
                  <span className="font-medium">{e.nome}</span>
                  {e.especificacoes && <span className="text-right text-sm text-zinc-400">{e.especificacoes}</span>}
                </li>
              ))}
              <li className="py-1.5 text-sm text-zinc-400">+ Instrumentos e pedais próprios dos músicos</li>
            </ul>
          </Sec>

          <Sec titulo="A casa ou evento precisa fornecer ou confirmar">
            <ul className="space-y-1">
              {CASA_FORNECE.map((p, i) => (
                <li key={i} className="border-b border-zinc-800/60 py-1.5 text-sm">{p}</li>
              ))}
            </ul>
          </Sec>

          <Sec titulo="Input list — mesa de 8 canais">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-amber-300">Show pequeno</p>
                <ol className="space-y-0.5 text-sm">
                  {INPUT_PEQUENO.map((p, i) => (
                    <li key={i}><span className="font-mono text-zinc-500">{i + 1}.</span> {p}</li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-amber-300">Setup cheio (2 guitarras)</p>
                <ol className="space-y-0.5 text-sm">
                  {INPUT_CHEIO.map((p, i) => (
                    <li key={i}><span className="font-mono text-zinc-500">{i + 1}.</span> {p}</li>
                  ))}
                </ol>
              </div>
            </div>
          </Sec>
        </div>

        <p className="mt-8 text-[10px] uppercase tracking-widest text-zinc-600 print:hidden">powered by StageBoss</p>
      </div>
    </div>
  );
}
