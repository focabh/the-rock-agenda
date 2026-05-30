// Gera um .docx com as letras do setlist do show, na ordem, formatado pro
// vocal (uma música por página). Usa a lib `docx`.

import { eq } from "drizzle-orm";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatDataBR } from "@/lib/formatters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const show = await db.query.shows.findFirst({
    where: eq(shows.id, id),
    with: {
      casa: true,
      setlists: { with: { items: { with: { song: true } } } },
    },
  });
  if (!show) return new Response("Show não encontrado", { status: 404 });

  const setlist = show.setlists[0];
  const items = (setlist?.items ?? []).sort((a, b) => a.ordem - b.ordem);

  const children: Paragraph[] = [
    new Paragraph({ text: "The Rock — Letras", heading: HeadingLevel.TITLE }),
    new Paragraph({
      text: `${show.casa.nome} — ${formatDataBR(show.data, true)}`,
      spacing: { after: 300 },
    }),
  ];

  items.forEach((it, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: i > 0,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `${i + 1}. ${it.song.titulo}`, bold: true }),
          new TextRun({
            text: `  —  ${it.song.artista}${it.tom ? ` (${it.tom})` : ""}`,
            italics: true,
          }),
        ],
      })
    );
    const lyr = it.song.lyrics?.trim();
    if (lyr) {
      for (const line of lyr.split("\n")) {
        children.push(new Paragraph({ text: line }));
      }
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "(letra não disponível — use “Sincronizar letras” no repertório)",
              italics: true,
            }),
          ],
        })
      );
    }
  });

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  const safeName = `${show.casa.nome}`
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "show";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="letras-${safeName}.docx"`,
    },
  });
}
