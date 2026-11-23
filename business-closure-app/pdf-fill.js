/* Client-side filler for the official VAT form 18 (הודעה על סגירת עסק).
   Overlays text onto the flat government PDF using pdf-lib + Heebo.
   Exposes window.fillOfficialVat(data, filename). */
(function () {
  "use strict";
  const PAGE_H = 842;
  const BOX = [41.8, 59.2, 76.6, 93.8, 111.2, 128.4, 145.6, 163.0, 180.4];

  // logical Hebrew -> visual order (reverse letter runs, keep digit runs LTR)
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
  function fmtDate(v) {
    if (!v) return "";
    const p = String(v).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
  }

  let cache = null;
  async function load() {
    if (cache) return cache;
    const [pdfBytes, fontBytes] = await Promise.all([
      fetch("assets/vat18.pdf").then(r => r.arrayBuffer()),
      fetch("assets/heebo.ttf").then(r => r.arrayBuffer())
    ]);
    cache = { pdfBytes, fontBytes };
    return cache;
  }

  async function fillOfficialVat(d, filename) {
    if (!window.PDFLib || !window.fontkit) throw new Error("libraries not loaded");
    const { PDFDocument, rgb } = window.PDFLib;
    const { pdfBytes, fontBytes } = await load();
    const pdf = await PDFDocument.load(pdfBytes);
    pdf.registerFontkit(window.fontkit);
    const font = await pdf.embedFont(fontBytes, { subset: false });
    const [p1, p2] = pdf.getPages();
    const INK = rgb(0.05, 0.10, 0.45);

    const put = (page, text, xRef, yTop, size, mode) => {
      if (text === "" || text == null) return;
      const vis = toVisual(text);
      const w = font.widthOfTextAtSize(vis, size);
      let x = xRef;
      if (mode === "right") x = xRef - w;
      else if (mode === "center") x = xRef - w / 2;
      page.drawText(vis, { x, y: PAGE_H - yTop, size, font, color: INK });
    };
    const digits = (page, num, yTop, size) => {
      const s = String(num || "").replace(/\D/g, "");
      for (let i = 0; i < s.length && i < BOX.length; i++) {
        const w = font.widthOfTextAtSize(s[i], size);
        page.drawText(s[i], { x: BOX[i] - w / 2, y: PAGE_H - yTop, size, font, color: INK });
      }
    };

    // Page 1
    digits(p1, d.osekNumber, 93.5, 11);
    digits(p1, d.idNumber || d.osekNumber, 114.5, 11);
    put(p1, d.bizName || d.fullName, 455, 92, 11, "right");
    put(p1, d.fullName, 463, 113, 11, "right");
    put(p1, d.bizAddress, 463, 132, 11, "right");
    put(p1, d.phone, 150, 132, 11, "right");
    put(p1, d.bizField, 463, 147, 11, "right");
    put(p1, d.bizAddress, 390, 162, 11, "right");
    put(p1, fmtDate(d.cessationDate), 292, 179, 11, "right");
    // Page 2 signature row
    put(p2, fmtDate(new Date().toISOString().slice(0, 10)), 476, 80, 11, "center");
    put(p2, d.fullName, 291, 80, 11, "center");

    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `טופס-מעמ-18-${d.osekNumber || "closure"}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  window.fillOfficialVat = fillOfficialVat;
})();
