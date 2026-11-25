/* Fill Israeli VAT form 18 (הודעה על סגירת עסק) — flat PDF, text overlay.
   Usage: node fill-vat.cjs <template.pdf> <data.json> <out.pdf>            */
const fs = require("fs");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const [, , TPL, DATA, OUT] = process.argv;
const d = JSON.parse(fs.readFileSync(DATA, "utf8"));
const PAGE_H = 842;

// Convert logical Hebrew string to visual order for a non-shaping renderer.
// Reverses letter runs, keeps digit/latin runs left-to-right.
function toVisual(s) {
  if (!s) return "";
  const segs = String(s).match(/([0-9][0-9.,\/\-]*)|([^0-9]+)/g) || [];
  let out = "";
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i];
    out += /^[0-9]/.test(seg) ? seg : seg.split("").reverse().join("");
  }
  return out;
}
const fmtDate = (v) => {
  if (!v) return "";
  const p = String(v).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
};

(async () => {
  const pdf = await PDFDocument.load(fs.readFileSync(TPL));
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fs.readFileSync(require.resolve(
    "@expo-google-fonts/heebo/400Regular/Heebo_400Regular.ttf")), { subset: false });
  const [p1, p2] = pdf.getPages();
  const INK = rgb(0.05, 0.10, 0.45);

  // draw text with top-origin y; mode: 'right' (end x), 'left' (start x), 'center'
  function put(page, text, xRef, yTop, size, mode) {
    if (text === "" || text == null) return;
    const vis = toVisual(text);
    const w = font.widthOfTextAtSize(vis, size);
    let x = xRef;
    if (mode === "right") x = xRef - w;
    else if (mode === "center") x = xRef - w / 2;
    const y = PAGE_H - yTop;
    for (const ch of vis) { page.drawText(ch, { x, y, size, font, color: INK }); x += font.widthOfTextAtSize(ch, size); }
  }
  // place a run of digits centered on each box center
  function digits(page, num, centers, yTop, size) {
    const s = String(num || "").replace(/\D/g, "");
    for (let i = 0; i < s.length && i < centers.length; i++) {
      const g = s[i];
      const w = font.widthOfTextAtSize(g, size);
      page.drawText(g, { x: centers[i] - w / 2, y: PAGE_H - yTop, size, font, color: INK });
    }
  }

  const BOX = [41.8, 59.2, 76.6, 93.8, 111.2, 128.4, 145.6, 163.0, 180.4];

  /* ---------- Page 1 ---------- */
  // digit grids
  digits(p1, d.osekNumber, BOX, 93.5, 11);   // מספרו (top)
  digits(p1, d.idNumber || d.osekNumber, BOX, 114.5, 11); // מס' עוסק / זהות
  // text lines (value ends near the label on the right)
  put(p1, d.bizName || d.fullName, 455, 92, 11, "right");  // שם העוסק / העסק
  put(p1, d.fullName, 463, 113, 11, "right");              // שם העוסק הפרטי
  put(p1, d.bizAddress, 463, 132, 11, "right");            // הכתובת הפרטית
  put(p1, d.phone, 150, 132, 11, "right");                 // טלפון לבירורים
  put(p1, d.bizField, 463, 147, 11, "right");              // סוג עסק שנסגר
  put(p1, d.bizAddress, 390, 162, 11, "right");            // מען להתכתבות לאחר סגירה
  put(p1, fmtDate(d.cessationDate), 292, 179, 11, "right"); // ... החל מיום ___

  /* ---------- Page 2: top signature row ---------- */
  put(p2, fmtDate(d.submitDate || new Date().toISOString().slice(0, 10)), 476, 80, 11, "center"); // תאריך
  put(p2, d.fullName, 291, 80, 11, "center");              // שם המוסמך לחתום
  // חתימה — left blank for manual signature

  fs.writeFileSync(OUT, await pdf.save());
  console.log("wrote", OUT);
})().catch(e => { console.error(e); process.exit(1); });
