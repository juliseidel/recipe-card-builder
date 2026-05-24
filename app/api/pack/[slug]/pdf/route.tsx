import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { PackPDF } from "@/lib/pdf/RecipeCardPDF";
import { getPackBySlug } from "@/data/packs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const pack = getPackBySlug(slug);
  if (!pack) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }

  try {
    const stream = await renderToStream(<PackPDF pack={pack} />);

    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pack.slug}.pdf"`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("PDF generation failed", error);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(error) },
      { status: 500 },
    );
  }
}
