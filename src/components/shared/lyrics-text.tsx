import { Fragment } from "react";

/** Renderiza a letra destacando trechos de "grito": tudo entre ^circunflexos^
 *  vira ênfase (o vocalista marca onde manda a voz). Ex.: "e eu ^GRITO AQUI^".
 *  Funciona no claro (caderno) e no escuro (teleprompter). */
export function LyricsText({
  text,
  tone = "light",
  className = "",
}: {
  text: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const shout =
    tone === "dark"
      ? "text-red-400 font-extrabold [text-shadow:0_0_14px_rgba(248,113,113,0.6)]"
      : "text-red-600 font-extrabold";

  const nodes: React.ReactNode[] = [];
  const re = /\^([^^]+)\^/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    nodes.push(
      <span key={i++} className={shout}>
        {m[1]}
      </span>
    );
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);

  return <pre className={`whitespace-pre-wrap font-sans ${className}`}>{nodes}</pre>;
}
