/* Fill Israeli Income-Tax form 2550 (הפסקת פעילות) — flat PDF, overlay.
   node fill-tax.cjs <template.pdf> <data.json> <out.pdf> */
const fs = require("fs");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const [, , TPL, DATA, OUT] = process.argv;
const d = JSON.parse(fs.readFileSync(DATA, "utf8"));
const PAGE_H = 841.89;
const ZID = [334.2, 345.5, 356.8, 368.2, 379.5, 390.8, 402.2, 413.6, 425.0];

function toVisual(s) {
  if (!s) return "";
  const segs = String(s).match(/([0-9][0-9.,\/\-]*)|([^0-9]+)/g) || [];
  let out = "";
  for (let i = segs.length - 1; i >= 0; i--) out += /^[0-9]/.test(segs[i]) ? segs[i] : segs[i].split("").reverse().join("");
  return out;
}
const dparts = (v) => { const p = String(v || "").split("-"); return p.length === 3 ? { d: p[2], m: p[1], y: p[0] } : { d: "", m: "", y: "" }; };

(async () => {
  const pdf = await PDFDocument.load(fs.readFileSync(TPL));
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fs.readFileSync(require.resolve("@expo-google-fonts/heebo/400Regular/Heebo_400Regular.ttf")), { subset: false });
  const pg = pdf.getPages()[0];
  const INK = rgb(0.05, 0.10, 0.45);
  const put = (text, xRef, yTop, size, mode) => {
    if (text === "" || text == null) return;
    const vis = toVisual(text), w = font.widthOfTextAtSize(vis, size);
    let x = xRef; if (mode === "right") x = xRef - w; else if (mode === "center") x = xRef - w / 2;
    const y = PAGE_H - yTop;
    for (const ch of vis) { pg.drawText(ch, { x, y, size, font, color: INK }); x += font.widthOfTextAtSize(ch, size); }
  };
  const digits = (num, centers, yTop, size) => {
    const s = String(num || "").replace(/\D/g, "");
    for (let i = 0; i < s.length && i < centers.length; i++) {
      const w = font.widthOfTextAtSize(s[i], size);
      pg.drawText(s[i], { x: centers[i] - w / 2, y: PAGE_H - yTop, size, font, color: INK });
    }
  };

  const check = (cx, yTop) => { const w = font.widthOfTextAtSize("X", 9); pg.drawText("X", { x: cx - w / 2, y: PAGE_H - yTop, size: 9, font, color: INK }); };
  // conditional checkboxes driven by the answers
  check(546, 246);                                   // "פרטים על הפסקת הפעילות" (always)
  const r = d.cessationReason;
  if (r === "sold") check(308, 270);
  else if (r === "rentedBusiness") check(223, 270);
  else if (r === "newCompany") check(137, 270);
  else if (r === "rentedApartment") check(453, 270);
  else if (r === "ceasedEmployee") check(453, 284);
  if (r === "sold") check(546, 330);                 // header: העסק נמכר
  if (r === "rentedBusiness") check(546, 370);        // header: העסק הושכר
  if (d.alsoEmployee === "yes") check(546, 410);      // header: שכיר/ה
  if (d.otherIncome === "yes") check(546, 600);       // header: הכנסות אחרות שלי
  if (d.employees === "yes") check(531, 682);         // הפסקת העסקת עובדים

  // closure date (dd / mm / yyyy) around slashes at x491.5 & x507.5, y~276
  const cd = dparts(d.cessationDate);
  put(cd.d, 483, 285, 10, "center");
  put(cd.m, 500, 285, 10, "center");
  put(cd.y, 520, 285, 10, "center");
  // כתובת העסק line (closure section)
  put(d.bizAddress, 216, 301, 10, "right");
  // bottom declaration row (data row y~764; labels below at 770)
  put(d.fullName, 490, 764, 10, "center");
  digits(d.idNumber || d.osekNumber, ZID, 765, 10);
  put(d.bizAddress, 230, 764, 10, "center");
  put(d.phone, 83, 764, 10, "center");
  // bottom date
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  put(todayStr, 485, 790, 10, "center");

  // ----- conditional text sections -----
  if (d.cessationReason === "sold") {
    const parts = String(d.buyerName || "").trim().split(/\s+/);
    const first = parts.shift() || "";
    put(first, 490, 356, 9, "center");          // שם פרטי
    put(parts.join(" "), 392, 356, 9, "center"); // שם משפחה
    put(d.buyerId, 292, 356, 9, "center");      // מספר זהות/ח.פ
    const sd = dparts(d.saleDate);
    put(sd.d, 186, 356, 9, "center");           // day (left)
    put(sd.m, 200, 356, 9, "center");           // month (mid)
    put(sd.y ? sd.y.slice(-2) : "", 216, 356, 9, "center"); // year (right)
    put(d.saleAmount, 95, 356, 9, "center");    // סכום המכירה
  }
  if (d.alsoEmployee === "yes") {
    put(d.employerName, 440, 437, 9, "center");    // השם המלא של המעביד
    put(d.employerAddress, 283, 442, 9, "center"); // כתובת המעביד (above caption)
  }
  if (d.otherIncome === "yes") {
    put(d.otherIncomeSource, 457, 627, 9, "center");
    put(d.otherIncomeAmount, 336, 627, 9, "center");
  }

  fs.writeFileSync(OUT, await pdf.save());
  console.log("wrote", OUT);
})().catch(e => { console.error(e); process.exit(1); });
