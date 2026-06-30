// Gera um .docx com as letras do setlist do ENSAIO (mesma formatação do show).

import { eq } from "drizzle-orm";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { db } from "@/db";
import { rehearsals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const sl = new URL(req.url).searchParams.get("sl");
  const r = await db.query.rehearsals.findFirst({
    where: eq(rehearsals.id, id),
    with: { setlists: { with: { items: { with: { song: true } } } } },
  });
  if (!r) return new Response("Ensaio não encontrado", { status: 404 });

  const setlist = (sl && r.setlists.find((s) => s.id === sl)) || r.setlists[0];
  const items = (setlist?.items ?? []).sort((a, b) => a.ordem - b.ordem);

  const children: Paragraph[] = [
    new Paragraph({ text: "The Rock — Letras (ensaio)", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `${r.local || "Ensaio"} — ${formatDataBR(r.data, true)}`, spacing: { after: 300 } }),
  ];

  items.forEach((it, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: i > 0,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `${i + 1}. ${it.song.titulo}`, bold: true }),
          new TextRun({ text: `  —  ${it.song.artista}${(it.song.tom) ? ` (${it.song.tom})` : ""}`, italics: true }),
        ],
      })
    );
    const lyr = it.song.lyrics?.trim();
    if (lyr) {
      for (const line of lyr.split("\n")) children.push(new Paragraph({ text: line }));
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: "(letra não disponível — use “Sincronizar letras” no repertório)", italics: true })] }));
    }
  });

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const safeName = (r.local || "ensaio").replace(/[^\x00-\x7f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "ensaio";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="letras-${safeName}.docx"`,
    },
  });
}
