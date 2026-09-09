/**
 * @smeditor/export-pdf
 *
 * Export a SMEditor JSON document to a PDF.
 *
 *   const bytes = await exportPdf(editor.getJSON());
 *   // bytes is a Uint8Array — write it to a file, or wrap it in a
 *   // Blob for download in the browser.
 *
 * The document is laid out by the pure `layoutDocument` (basic
 * block-flow: paragraph wrapping, heading sizes, indented lists) and
 * the resulting lines are drawn onto pages with `pdf-lib`, paginating
 * as the cursor reaches the bottom margin.
 *
 * Scope: this is a faithful text export, not a pixel-perfect render.
 * Tables become tab-separated lines, images become alt text, and
 * there is no wrap-around layout. A full-fidelity exporter would need
 * a complete text-layout engine.
 */

import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import type { DocumentJSON } from "@smeditor/core";
import { layoutDocument, type MeasureText } from "./layout.js";

export { layoutDocument } from "./layout.js";
export type {
  TypesetLine,
  LineSpan,
  LayoutOptions,
  MeasureText,
} from "./layout.js";

export interface ExportPdfOptions {
  /** Page width in points (default: US Letter, 612). */
  pageWidth?: number;
  /** Page height in points (default: US Letter, 792). */
  pageHeight?: number;
  /** Page margin in points (default: 56 ~ 0.78in). */
  margin?: number;
  /** Base body font size (default: 11). */
  baseSize?: number;
}

/**
 * Defensive guard: strip any control characters (char code < 0x20)
 * that survived layout, so nothing the StandardFont WinAnsi encoder
 * cannot encode (e.g. "\n", "\t") can reach pdf-lib's draw/measure.
 */
function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f]/g, "");
}

/**
 * Export a SMEditor document to a PDF, returned as a `Uint8Array`.
 */
export async function exportPdf(
  doc: DocumentJSON,
  options: ExportPdfOptions = {},
): Promise<Uint8Array> {
  const pageWidth = options.pageWidth ?? 612;
  const pageHeight = options.pageHeight ?? 792;
  const margin = options.margin ?? 56;
  const baseSize = options.baseSize ?? 11;
  const contentWidth = pageWidth - margin * 2;

  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };

  const pick = (bold: boolean, italic: boolean, mono: boolean): PDFFont => {
    if (mono) return fonts.mono;
    if (bold && italic) return fonts.boldItalic;
    if (bold) return fonts.bold;
    if (italic) return fonts.italic;
    return fonts.regular;
  };

  // Text measurement for the layout pass.
  const measure: MeasureText = (text, size, bold) =>
    (bold ? fonts.bold : fonts.regular).widthOfTextAtSize(sanitize(text), size);

  const lines = layoutDocument(doc, { contentWidth, baseSize }, measure);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  for (const line of lines) {
    const lineHeight = line.size * 1.3;
    cursorY -= line.spaceBefore;
    // New page when the line would cross the bottom margin.
    if (cursorY - lineHeight < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
      cursorY -= line.spaceBefore;
    }
    cursorY -= lineHeight;

    let x = margin + line.indent;
    for (const span of line.spans) {
      const text = sanitize(span.text);
      if (!text) continue;
      const font = pick(span.bold, span.italic, line.mono);
      page.drawText(text, {
        x,
        y: cursorY,
        size: line.size,
        font,
      });
      x += font.widthOfTextAtSize(text, line.size);
    }
  }

  return pdf.save();
}
