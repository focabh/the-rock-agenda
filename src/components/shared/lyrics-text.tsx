import { Fragment } from "react";

/** Quebra um trecho em nós, destacando "gritos" entre ^circunflexos^. */
function parseShout(text: string, shoutCls: string, keyOffset = 0): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\^([^^]+)\^/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = keyOffset;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    nodes.push(
      <span key={i++} className={shoutCls}>
        {m[1]}
      </span>
    );
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return nodes;
}

/** Renderiza a letra destacando trechos de "grito": tudo entre ^circunflexos^
 *  vira ênfase (o vocalista marca onde manda a voz). Ex.: "e eu ^GRITO AQUI^".
 *  Funciona no claro (caderno) e no escuro (teleprompter).
 *  Com `clickable`, cada linha pode ser tocada pra centralizar na tela. */
export function LyricsText({
  text,
  tone = "light",
  className = "",
  clickable = false,
}: {
  text: string;
  tone?: "light" | "dark";
  className?: string;
  clickable?: boolean;
}) {
  const shout =
    tone === "dark"
      ? "text-red-400 font-extrabold [text-shadow:0_0_14px_rgba(248,113,113,0.6)]"
      : "text-red-600 font-extrabold";

  if (clickable) {
    const lines = text.split(/\r?\n/);
    return (
      <div className={`font-sans ${className}`}>
        {lines.map((line, idx) => (
          <div
            key={idx}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
            title="Tocar pra centralizar esta linha"
            className="cursor-pointer whitespace-pre-wrap rounded-lg px-2 leading-[1.4] transition-colors hover:bg-white/10"
          >
            {line ? parseShout(line, shout) : " "}
          </div>
        ))}
      </div>
    );
  }

  return <pre className={`whitespace-pre-wrap font-sans ${className}`}>{parseShout(text, shout)}</pre>;
}
