/* Client-side filler for the official Israeli closure forms (flat PDFs).
   Overlays text with pdf-lib + embedded Heebo. All in-browser, no server.
   Exposes window.fillOfficialVat(data) and window.fillOfficialTax(data). */
(function () {
  "use strict";

  // logical Hebrew -> visual order (reverse letter runs, keep digit runs LTR)
  function toVisual(s) {
    if (!s) return "";
    const segs = String(s).match(/([0-9][0-9.,\/\-]*)|([^0-9]+)/g) || [];
    let out = "";
    for (let i = segs.length - 1; i >= 0; i--)
      out += /^[0-9]/.test(segs[i]) ? segs[i] : segs[i].split("").reverse().join("");
    return out;
  }
  const fmtDate = (v) => { const p = String(v || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (v || ""); };
  const dparts = (v) => { const p = String(v || "").split("-"); return p.length === 3 ? { d: p[2], m: p[1], y: p[0] } : { d: "", m: "", y: "" }; };
  const todayStr = () => { const t = new Date(); return `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`; };

  let fontBytes = null;
  const tplCache = {};
  async function getFont() {
    if (!fontBytes) fontBytes = await fetch("assets/heebo.ttf").then(r => r.arrayBuffer());
    return fontBytes;
  }
  async function getTpl(url) {
    if (!tplCache[url]) tplCache[url] = await fetch(url).then(r => r.arrayBuffer());
    return tplCache[url];
  }

  async function prepare(tplUrl) {
    if (!window.PDFLib || !window.fontkit) throw new Error("libraries not loaded");
    const { PDFDocument, rgb } = window.PDFLib;
    const [tplBytes, fBytes] = await Promise.all([getTpl(tplUrl), getFont()]);
    const pdf = await PDFDocument.load(tplBytes);
    pdf.registerFontkit(window.fontkit);
    const font = await pdf.embedFont(fBytes, { subset: false });
    const INK = rgb(0.05, 0.10, 0.45);
    const H = pdf.getPages()[0].getHeight();
    // Draw RTL text as individually-positioned glyphs in visual order, so no
    // PDF viewer's bidi engine can re-order it (identical in every viewer).
    const put = (page, text, xRef, yTop, size, mode) => {
      if (text === "" || text == null) return;
      const vis = toVisual(text), w = font.widthOfTextAtSize(vis, size);
      let x = xRef; if (mode === "right") x = xRef - w; else if (mode === "center") x = xRef - w / 2;
      const y = H - yTop;
      for (const ch of vis) {
        page.drawText(ch, { x, y, size, font, color: INK });
        x += font.widthOfTextAtSize(ch, size);
      }
    };
    const digits = (page, num, centers, yTop, size) => {
      const s = String(num || "").replace(/\D/g, "");
      for (let i = 0; i < s.length && i < centers.length; i++) {
        const w = font.widthOfTextAtSize(s[i], size);
        page.drawText(s[i], { x: centers[i] - w / 2, y: H - yTop, size, font, color: INK });
      }
    };
    const check = (page, cx, yTop) => { const w = font.widthOfTextAtSize("X", 9); page.drawText("X", { x: cx - w / 2, y: H - yTop, size: 9, font, color: INK }); };
    return { pdf, put, digits, check };
  }

  async function download(pdf, filename) {
    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- VAT form 18 ---------- */
  async function fillOfficialVat(d) {
    const { pdf, put, digits, check } = await prepare("assets/vat18.pdf");
    const [p1, p2] = pdf.getPages();
    const BOX = [41.8, 59.2, 76.6, 93.8, 111.2, 128.4, 145.6, 163.0, 180.4];
    digits(p1, d.osekNumber, BOX, 93.5, 11);
    digits(p1, d.idNumber || d.osekNumber, BOX, 114.5, 11);
    put(p1, d.bizName || d.fullName, 455, 92, 11, "right");
    put(p1, d.fullName, 463, 113, 11, "right");
    put(p1, d.bizAddress, 463, 132, 11, "right");
    put(p1, d.phone, 150, 132, 11, "right");
    put(p1, d.bizField, 463, 147, 11, "right");
    put(p1, d.bizAddress, 390, 162, 11, "right");
    put(p1, fmtDate(d.cessationDate), 292, 179, 11, "right");
    if (d.businessPremises === "owned") check(p1, 361, 352);   // המבנה בבעלותי: כן
    else if (d.businessPremises === "rented") check(p1, 289, 352); // בשכירות
    put(p2, todayStr(), 476, 80, 11, "center");
    put(p2, d.fullName, 291, 80, 11, "center");
    await download(pdf, `טופס-מעמ-18-${d.osekNumber || "closure"}.pdf`);
  }

  /* ---------- Income-tax form 2550 ---------- */
  async function fillOfficialTax(d) {
    const { pdf, put, digits, check } = await prepare("assets/tax2550.pdf");
    const pg = pdf.getPages()[0];
    const ZID = [334.2, 345.5, 356.8, 368.2, 379.5, 390.8, 402.2, 413.6, 425.0];
    // conditional checkboxes driven by the answers
    check(pg, 546, 246);                                 // פרטים על הפסקת הפעילות (always)
    const r = d.cessationReason;
    if (r === "sold") check(pg, 308, 270);
    else if (r === "rentedBusiness") check(pg, 223, 270);
    else if (r === "newCompany") check(pg, 137, 270);
    else if (r === "rentedApartment") check(pg, 453, 270);
    else if (r === "ceasedEmployee") check(pg, 453, 284);
    if (r === "sold") check(pg, 546, 330);               // העסק נמכר
    if (r === "rentedBusiness") check(pg, 546, 370);      // העסק הושכר
    if (d.alsoEmployee === "yes") check(pg, 546, 410);    // שכיר/ה
    if (d.otherIncome === "yes") check(pg, 546, 600);     // הכנסות אחרות שלי
    if (d.employees === "yes") check(pg, 531, 682);       // הפסקת העסקת עובדים
    const cd = dparts(d.cessationDate);
    put(pg, cd.d, 483, 285, 10, "center");
    put(pg, cd.m, 500, 285, 10, "center");
    put(pg, cd.y, 520, 285, 10, "center");
    put(pg, d.bizAddress, 216, 301, 10, "right");          // כתובת העסק (closure)
    put(pg, d.fullName, 490, 764, 10, "center");           // שם מלא
    digits(pg, d.idNumber || d.osekNumber, ZID, 766, 10);  // מספר זהות
    put(pg, d.bizAddress, 230, 764, 10, "center");         // כתובת
    put(pg, d.phone, 83, 764, 10, "center");               // מספר טלפון
    put(pg, todayStr(), 485, 790, 10, "center");           // תאריך
    // conditional text sections
    if (r === "sold") {
      const parts = String(d.buyerName || "").trim().split(/\s+/);
      put(pg, parts.shift() || "", 490, 356, 9, "center");   // שם פרטי
      put(pg, parts.join(" "), 392, 356, 9, "center");       // שם משפחה
      put(pg, d.buyerId, 292, 356, 9, "center");             // מספר זהות/ח.פ
      const sd = dparts(d.saleDate);
      put(pg, sd.d, 186, 356, 9, "center");
      put(pg, sd.m, 200, 356, 9, "center");
      put(pg, sd.y ? sd.y.slice(-2) : "", 216, 356, 9, "center");
      put(pg, d.saleAmount, 95, 356, 9, "center");           // סכום המכירה
    }
    if (d.alsoEmployee === "yes") {
      put(pg, d.employerName, 440, 437, 9, "center");        // השם המלא של המעביד
      put(pg, d.employerAddress, 283, 442, 9, "center");     // כתובת המעביד
    }
    if (d.otherIncome === "yes") {
      put(pg, d.otherIncomeSource, 457, 627, 9, "center");
      put(pg, d.otherIncomeAmount, 336, 627, 9, "center");
    }
    await download(pdf, `טופס-2550-${d.osekNumber || "closure"}.pdf`);
  }

  window.fillOfficialVat = fillOfficialVat;
  window.fillOfficialTax = fillOfficialTax;
})();
