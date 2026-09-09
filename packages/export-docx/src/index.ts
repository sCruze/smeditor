/**
 * @smeditor/export-docx
 *
 * Export a SMEditor JSON document to a Word `.docx` file.
 *
 *   const bytes = await exportDocx(editor.getJSON());
 *   // bytes is a Uint8Array — write it to a file or hand it to a
 *   // Blob for download in the browser.
 *
 * A `.docx` is a ZIP of XML parts. This module produces the document
 * body via the pure `documentXml` generator and wraps it with the
 * small set of boilerplate parts Word requires.
 */

import JSZip from "jszip";
import type { DocumentJSON } from "@smeditor/core";
import { documentXml } from "./ooxml.js";

export { documentXml } from "./ooxml.js";

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const DOC_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

/** A minimal styles part defining the styles `ooxml.ts` references. */
function stylesXml(): string {
  const w =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const heading = (n: number) =>
    `<w:style w:type="paragraph" w:styleId="Heading${n}">` +
    `<w:name w:val="heading ${n}"/>` +
    `<w:pPr><w:keepNext/><w:spacing w:before="${240 - n * 20}" w:after="60"/></w:pPr>` +
    `<w:rPr><w:b/><w:sz w:val="${36 - n * 3}"/></w:rPr></w:style>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:styles ${w}>` +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
    '<w:name w:val="Normal"/></w:style>' +
    [1, 2, 3, 4, 5, 6].map(heading).join("") +
    '<w:style w:type="paragraph" w:styleId="Quote">' +
    '<w:name w:val="Quote"/>' +
    '<w:pPr><w:ind w:left="720"/></w:pPr>' +
    '<w:rPr><w:i/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Code">' +
    '<w:name w:val="Code"/>' +
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListParagraph">' +
    '<w:name w:val="List Paragraph"/>' +
    '<w:pPr><w:ind w:left="360"/></w:pPr></w:style>' +
    "</w:styles>"
  );
}

/**
 * Export a SMEditor document to a `.docx`, returned as a
 * `Uint8Array`. In the browser, wrap it in a Blob to download:
 *
 *   const blob = new Blob([await exportDocx(doc)], {
 *     type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 *   });
 */
export async function exportDocx(doc: DocumentJSON): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file("word/document.xml", documentXml(doc));
  zip.file("word/_rels/document.xml.rels", DOC_RELS);
  zip.file("word/styles.xml", stylesXml());
  return zip.generateAsync({ type: "uint8array" });
}
