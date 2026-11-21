// Builds a Design Doc .docx from the block model written by build_docs.py.
// node docx_build.js <model.json> <he|en> <out.docx> <arch.png>
// Arial throughout. Hebrew: bidirectional paragraphs, RTL runs only for non-Latin segments
// (Latin/number segments stay LTR so 1,000GW, P99, plan_version keep their order).
const fs = require("fs");
const D = require("docx");
const [, , modelPath, lang, outPath, archPath] = process.argv;
const B = JSON.parse(fs.readFileSync(modelPath, "utf8"));
const RTL = lang === "he";
const FONT = { ascii: "Arial", hAnsi: "Arial", cs: "Arial", eastAsia: "Arial" };
const MONO = { ascii: "Consolas", hAnsi: "Consolas", cs: "Consolas" };
const BLUE = "1D4ED8", INK = "14213A", MUTED = "53627C", LINE = "CFD9EA";
const PAGE_W = 11906, MARGIN = 1080, CONTENT = PAGE_W - 2 * MARGIN;
const LTR_RE = /([0-9A-Za-z_][0-9A-Za-z_.,%×+\-–\/:|{}()]*[0-9A-Za-z_%})]|[0-9A-Za-z])/g;

function runs(text, o = {}) {
  // **bold** -> bold; then split into LTR / RTL segments for Hebrew
  const out = [];
  String(text).split(/(\*\*[^*]+\*\*)/).forEach(part => {
    if (!part) return;
    const bold = /^\*\*.*\*\*$/.test(part);
    const t = bold ? part.slice(2, -2) : part;
    const segs = [];
    if (RTL) {
      let last = 0; t.replace(LTR_RE, (m, _g, idx) => { if (idx > last) segs.push([t.slice(last, idx), true]); segs.push([m, false]); last = idx + m.length; return m; });
      if (last < t.length) segs.push([t.slice(last), true]);
    } else segs.push([t, false]);
    segs.forEach(([s, rtl]) => out.push(new D.TextRun({
      text: s, bold: o.heading ? undefined : (bold || o.bold), boldComplexScript: o.heading ? undefined : (bold || o.bold), italics: o.italics,
      font: o.mono ? MONO : FONT, size: o.heading ? undefined : (o.size || 21), sizeComplexScript: o.heading ? undefined : (o.size || 21),
      color: o.heading ? undefined : (o.color || INK), rightToLeft: rtl && RTL,
    })));
  });
  return out;
}
const P = (text, o = {}) => new D.Paragraph({
  children: runs(text, o), bidirectional: RTL && !o.ltr, alignment: o.ltr ? D.AlignmentType.LEFT : undefined,
  spacing: { after: o.after == null ? 100 : o.after, before: o.before || 0, line: 288 }, keepNext: o.keepNext,
  heading: o.heading, numbering: o.numbering, border: o.border, shading: o.shading, indent: o.indent,
});
const cellBorders = { top: { style: D.BorderStyle.SINGLE, size: 4, color: LINE }, bottom: { style: D.BorderStyle.SINGLE, size: 4, color: LINE },
  left: { style: D.BorderStyle.SINGLE, size: 4, color: LINE }, right: { style: D.BorderStyle.SINGLE, size: 4, color: LINE } };

function table(b) {
  const widths = b.widths.map(w => Math.round(CONTENT * w / 100));
  widths[widths.length - 1] += CONTENT - widths.reduce((a, c) => a + c, 0);
  const ltr = b.ltrcols || [];
  const HEB = /[\u0590-\u05FF]/;
  const mk = (txt, i, head) => { const lt = !head && RTL && !HEB.test(txt) && txt !== ""; return new D.TableCell({
    width: { size: widths[i], type: D.WidthType.DXA }, borders: cellBorders,
    shading: head ? { type: D.ShadingType.CLEAR, fill: "EAF0F9", color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [P(txt, { size: ltr.includes(i) && !head ? 17 : 18, bold: head, mono: ltr.includes(i) && !head, ltr: (ltr.includes(i) && !head) || lt, after: 0 })],
  }); };
  return new D.Table({
    width: { size: CONTENT, type: D.WidthType.DXA }, columnWidths: widths, visuallyRightToLeft: RTL,
    rows: [new D.TableRow({ tableHeader: true, children: b.head.map((h, i) => mk(h, i, true)) })]
      .concat(b.rows.map(r => new D.TableRow({ cantSplit: true, children: r.map((c, i) => mk(c, i, false)) }))),
  });
}
function pngSize(p) { const b = fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

const children = [];
for (const b of B) {
  switch (b.t) {
    case "title":
      children.push(P("BLUEPRINT · DESIGN DOC", { size: 16, color: BLUE, ltr: false, after: 60 }));
      children.push(P(b.text, { heading: D.HeadingLevel.TITLE, after: 80 })); break;
    case "subtitle": children.push(P(b.text, { size: 24, color: MUTED, after: 200 })); break;
    case "meta": children.push(table({ head: [RTL ? "פרט" : "Field", RTL ? "ערך" : "Value"], rows: b.rows, widths: [22, 78], ltrcols: [] }));
      children.push(P("", { after: 120 })); break;
    case "h1": children.push(P(b.text, { heading: D.HeadingLevel.HEADING_1 })); break;
    case "h2": children.push(P(b.text, { heading: D.HeadingLevel.HEADING_2 })); break;
    case "h3": children.push(P(b.text, { heading: D.HeadingLevel.HEADING_3, ltr: b.ltr })); break;
    case "p": children.push(P(b.text, b.small ? { size: 19, color: "3C4A63" } : {})); break;
    case "quote": children.push(P(b.text, { size: 22, shading: { type: D.ShadingType.CLEAR, fill: "EEF3FC", color: "auto" },
      border: { [RTL ? "right" : "left"]: { style: D.BorderStyle.SINGLE, size: 18, color: BLUE, space: 8 } }, after: 160 })); break;
    case "ul": b.items.forEach(x => children.push(P(x, { numbering: { reference: "bul", level: 0 }, after: 40 }))); children.push(P("", { after: 40 })); break;
    case "code":
      children.push(P(b.title, { size: 18, color: MUTED, before: 80, after: 40, keepNext: true }));
      b.text.split("\n").forEach((line, i, arr) => children.push(new D.Paragraph({
        bidirectional: false, alignment: D.AlignmentType.LEFT, keepNext: i < arr.length - 1, keepLines: true,
        shading: { type: D.ShadingType.CLEAR, fill: "F3F6FB", color: "auto" }, spacing: { after: 0, line: 240 },
        children: [new D.TextRun({ text: line.replace(/ /g, " ") || " ", font: MONO, size: 16 })] })));
      children.push(P("", { after: 100 })); break;
    case "image": {
      const [w, h] = pngSize(archPath); const W = 620, H = Math.round(W * h / w);
      children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.ImageRun({ type: "png", data: fs.readFileSync(archPath), transformation: { width: W, height: H } })] }));
      children.push(P(b.caption, { size: 17, color: MUTED, after: 160 })); break;
    }
    case "table": children.push(table(b)); children.push(P("", { after: 80 })); break;
    case "source": children.push(P(b.text, { size: 17, color: MUTED, before: 240, border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } } })); break;
  }
}

const hstyle = (size, color, before, after, font) => ({ run: { font: font || FONT, size, sizeComplexScript: size, bold: true, boldComplexScript: true, color },
  paragraph: { spacing: { before, after }, keepNext: true, keepLines: true } });
const doc = new D.Document({
  creator: "Blueprint · Desk", title: B[0].text,
  styles: {
    default: {
      document: { run: { font: FONT, size: 21, sizeComplexScript: 21 } },
      title: hstyle(44, INK, 160, 100), heading1: hstyle(30, BLUE, 320, 120),
      heading2: hstyle(25, INK, 240, 80), heading3: hstyle(22, INK, 160, 60),
    },
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: D.LevelFormat.BULLET, text: "•", alignment: RTL ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1080, bottom: 1080, left: MARGIN, right: MARGIN } } },
    footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [
      new D.TextRun({ text: "Blueprint · Design Doc · ", font: FONT, size: 15, color: MUTED }),
      new D.TextRun({ children: [D.PageNumber.CURRENT], font: FONT, size: 15, color: MUTED }),
      new D.TextRun({ text: " / ", font: FONT, size: 15, color: MUTED }),
      new D.TextRun({ children: [D.PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: MUTED })] })] }) },
    children,
  }],
});
D.Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outPath, buf); console.log("wrote", outPath); });
