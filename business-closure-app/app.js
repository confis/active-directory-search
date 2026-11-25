/* =========================================================================
   סגירת עסק בקלות — אפליקציית צד-לקוח
   כל הנתונים נשמרים מקומית בדפדפן (localStorage). אין שרת, אין שליחה החוצה.
   ========================================================================= */

(function () {
  "use strict";

  const LS_KEY = "biz_closure_v1";
  const app = document.getElementById("app");
  const progressEl = document.getElementById("progress");
  const printArea = document.getElementById("printArea");
  const toastEl = document.getElementById("toast");

  /* ---------------- State ---------------- */
  const defaultState = () => ({
    step: 0,
    data: {
      businessType: "",      // 'patur' | 'murshe'
      fullName: "", idNumber: "", osekNumber: "", phone: "", email: "",
      bizName: "", bizAddress: "", bizField: "",
      openDate: "", cessationDate: "", cessationReason: "",
      activity2026: "", incomeInClosingYear: "",
      unreportedDocs: "", debts: "", debtsDetail: "",
      hasStock: "", hasEquipment: "", assetsDetail: "",
      employees: "", withholdingFile: "", businessPremises: "",
      alsoEmployee: "", otherIncome: "", overpaid: "",
      buyerName: "", buyerId: "", saleDate: "", saleAmount: "",
      employerName: "", employerAddress: "",
      otherIncomeSource: "", otherIncomeAmount: "",
      notes: ""
    },
    tracking: {},   // key -> {status, ref}
    confirmed: false
  });

  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {}
    return defaultState();
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------------- Helpers ---------------- */
  const D = () => S.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const typeLabel = () => D().businessType === "murshe" ? "עוסק מורשה" : "עוסק פטור";

  function fmtDate(v) {
    if (!v) return "—";
    const p = v.split("-");
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return v;
  }
  function yn(v) { return v === "yes" ? "כן" : v === "no" ? "לא" : "—"; }
  function reasonLabel(v) {
    return ({ plainClosure: "סגירה / חדילת פעילות", sold: "מכירת העסק", rentedBusiness: "השכרת העסק",
      newCompany: "הקמת חברה חדשה", rentedApartment: "השכרת דירה למגורים", ceasedEmployee: "חדלתי להיות שכיר בעל שליטה" }[v]) || "—";
  }

  // אימות מספר תעודת זהות ישראלי לפי ספרת ביקורת (אלגוריתם לוהן)
  function validIsraeliId(v) {
    v = String(v == null ? "" : v).trim();
    if (!/^\d{1,9}$/.test(v)) return false;
    v = v.padStart(9, "0");
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let n = Number(v[i]) * ((i % 2) + 1);
      if (n > 9) n -= 9;
      sum += n;
    }
    return sum % 10 === 0;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ---------------- Steps meta ---------------- */
  const STEPS = [
    { key: "type", label: "סוג עסק" },
    { key: "details", label: "פרטים" },
    { key: "activity", label: "פעילות" },
    { key: "finance", label: "כספים" },
    { key: "assets", label: "נכסים" },
    { key: "btl", label: "ביטוח לאומי" },
    { key: "review", label: "סקירה" },
    { key: "result", label: "מסמכים" }
  ];

  function renderProgress() {
    progressEl.innerHTML = STEPS.map((s, i) => {
      const cls = i < S.step ? "done" : i === S.step ? "active" : "";
      return `<div class="progress-step ${cls}">
        <div class="progress-bar"><span></span></div>
        <div class="progress-label">${s.label}</div>
      </div>`;
    }).join("");
  }

  /* ========================================================================
     STEP RENDERERS
     ======================================================================== */

  function stepType() {
    const t = D().businessType;
    return `
    <div class="card">
      <div class="step-eyebrow">שלב 1 מתוך 7</div>
      <h2>בואו נסגור את העסק — בלי כאב ראש</h2>
      <p class="sub">נאסוף פעם אחת את כל המידע, נכין את הטפסים לכל רשות, וניתן לך תוכנית הגשה ברורה צעד-אחר-צעד. ההליך לוקח כ-5 דקות.</p>

      <div class="alert alert-info">
        <span class="ai">🔒</span>
        <div><strong>הפרטיות שלך נשמרת</strong>כל המידע נשמר אך ורק במכשיר שלך ואינו נשלח לאף שרת. אל תזין כאן סיסמאות או קודי הזדהות — ההגשה עצמה נעשית באתרי הרשויות עם ההזדהות האישית שלך.</div>
      </div>

      <h3 style="font-size:16px;font-weight:800;margin:6px 0 2px">מה סוג העסק שברצונך לסגור?</h3>
      <div class="type-grid">
        <div class="type-card ${t === 'patur' ? 'selected' : ''}" data-type="patur">
          <div class="check">✓</div>
          <div class="ic">🧾</div>
          <h3>עוסק פטור</h3>
          <p>עסק שאינו גובה מע״מ ומגיש הצהרת מחזור שנתית. ההליך הפשוט ביותר.</p>
        </div>
        <div class="type-card ${t === 'murshe' ? 'selected' : ''}" data-type="murshe">
          <div class="check">✓</div>
          <div class="ic">📊</div>
          <h3>עוסק מורשה</h3>
          <p>עסק המדווח מע״מ תקופתי. נדרש גם סיום דיווחי המע״מ ודיווח על מלאי/ציוד.</p>
        </div>
      </div>

      <div class="nav">
        <span></span>
        <button class="btn btn-primary" id="next" ${t ? "" : "disabled"}>להתחיל ←</button>
      </div>
    </div>`;
  }

  function stepDetails() {
    const d = D();
    return `
    <div class="card">
      <div class="step-eyebrow">שלב 2 מתוך 7 · ${typeLabel()}</div>
      <h2>פרטים אישיים ופרטי העסק</h2>
      <p class="sub">הפרטים האלה ימולאו אוטומטית בכל הטפסים שניצור עבורך.</p>

      <div class="section-title">פרטי בעל/ת העסק</div>
      <div class="field-grid">
        ${textField("fullName", "שם מלא", d.fullName, true, "כפי שמופיע בתעודת הזהות")}
        ${textField("idNumber", "מספר תעודת זהות", d.idNumber, true, "9 ספרות", "inputmode=numeric maxlength=9")}
        ${textField("phone", "טלפון נייד", d.phone, true, "", "inputmode=tel")}
        ${textField("email", "דוא״ל", d.email, false, "לקבלת אסמכתאות", "type=email")}
      </div>

      <div class="section-title">פרטי העסק</div>
      <div class="field-grid">
        ${textField("osekNumber", "מספר עוסק", d.osekNumber, true, "לרוב זהה למספר ת.ז.", "inputmode=numeric")}
        ${textField("bizField", "תחום העיסוק", d.bizField, false, "לדוגמה: ייעוץ, עיצוב גרפי")}
        ${textField("bizName", "שם העסק", d.bizName, false, "אם קיים שם מסחרי")}
        ${textField("bizAddress", "כתובת העסק", d.bizAddress, true, "רחוב, עיר ומיקוד")}
        ${dateField("openDate", "תאריך פתיחת העסק", d.openDate, false)}
      </div>

      ${navButtons()}
    </div>`;
  }

  function stepActivity() {
    const d = D();
    return `
    <div class="card">
      <div class="step-eyebrow">שלב 3 מתוך 7 · ${typeLabel()}</div>
      <h2>מועד ופרטי הפסקת הפעילות</h2>
      <p class="sub">תאריך הפסקת הפעילות הוא הנתון המרכזי בכל הטפסים. חשוב שיהיה מדויק ואחיד בכל הרשויות.</p>

      <div class="field-grid">
        ${dateField("cessationDate", "תאריך הפסקת הפעילות בפועל", d.cessationDate, true, "היום שבו העסק הפסיק לפעול בפועל")}
      </div>

      <div class="section-title">פעילות בשנת הסגירה</div>
      ${choiceField("activity2026", "האם הייתה פעילות עסקית בשנת הסגירה (2026)?", d.activity2026,
        [["yes", "כן, הייתה פעילות"], ["no", "לא הייתה פעילות"]])}
      ${choiceField("incomeInClosingYear", "האם היו הכנסות בשנת הסגירה?", d.incomeInClosingYear,
        [["yes", "כן, היו הכנסות"], ["no", "לא היו הכנסות"]])}

      <div class="section-title">סיבת הפסקת הפעילות</div>
      <p class="hint" style="margin:-8px 0 10px">נשתמש בזה כדי לסמן אוטומטית את התיבה המתאימה בטופס 2550.</p>
      ${choiceField("cessationReason", "מהי סיבת הסגירה?", d.cessationReason,
        [["plainClosure", "סגירה / חדילת פעילות"], ["sold", "מכירת העסק"], ["rentedBusiness", "השכרת העסק"],
         ["newCompany", "הקמת חברה חדשה"], ["rentedApartment", "השכרת דירה למגורים"], ["ceasedEmployee", "חדלתי להיות שכיר בעל שליטה"]])}

      <div class="reveal ${d.cessationReason === 'sold' ? 'show' : ''}" data-reveal="sold">
        <div class="field-grid" style="margin-top:4px">
          ${textField("buyerName", "שם הרוכש", d.buyerName, false, "שם פרטי ומשפחה")}
          ${textField("buyerId", "ת.ז. / ח.פ. של הרוכש", d.buyerId, false, "", "inputmode=numeric")}
          ${dateField("saleDate", "תאריך המכירה", d.saleDate, false)}
          ${textField("saleAmount", "סכום המכירה (₪)", d.saleAmount, false, "", "inputmode=numeric")}
        </div>
      </div>

      <div class="alert alert-warn" style="margin-top:20px">
        <span class="ai">⚠️</span>
        <div><strong>שים לב</strong>אין לציין "אפס הכנסות" או "ללא פעילות" אם זה אינו נכון. דיווח לא מדויק לרשויות עלול לגרור קנסות. דווח את המצב כפי שהוא בפועל.</div>
      </div>

      ${navButtons()}
    </div>`;
  }

  function stepFinance() {
    const d = D();
    return `
    <div class="card">
      <div class="step-eyebrow">שלב 4 מתוך 7 · ${typeLabel()}</div>
      <h2>מצב דיווחים וחובות</h2>
      <p class="sub">נזהה מראש נקודות שעלולות לעכב את הסגירה, כדי שתטפל בהן בזמן.</p>

      ${choiceField("unreportedDocs", "האם קיימות חשבוניות / קבלות שטרם דווחו?", d.unreportedDocs,
        [["yes", "כן, יש מסמכים שלא דווחו"], ["no", "לא, הכול דווח"]])}

      ${choiceField("debts", "האם קיימים חובות פתוחים לרשויות?", d.debts,
        [["yes", "כן, קיימים חובות"], ["no", "לא ידוע לי על חובות"]])}

      <div class="reveal ${d.debts === 'yes' ? 'show' : ''}" data-reveal="debts">
        <div class="field full" style="margin-top:14px">
          <label>פירוט החובות <span class="hint">(לאיזו רשות וסכום משוער, אם ידוע)</span></label>
          <textarea data-key="debtsDetail" placeholder="לדוגמה: מקדמות מס הכנסה 2025, יתרת מע״מ...">${esc(d.debtsDetail)}</textarea>
        </div>
      </div>

      <div class="alert alert-info" style="margin-top:20px">
        <span class="ai">ℹ️</span>
        <div><strong>חשוב לדעת</strong>סגירת התיקים אינה מבטלת חובות או חובות דיווח שנוצרו בתקופות קודמות. חוב פתוח יש להסדיר בנפרד.</div>
      </div>

      ${navButtons()}
    </div>`;
  }

  function stepAssets() {
    const d = D();
    const showAssetDetail = d.hasStock === "yes" || d.hasEquipment === "yes";
    return `
    <div class="card">
      <div class="step-eyebrow">שלב 5 מתוך 7 · ${typeLabel()}</div>
      <h2>נכסים, מלאי ועובדים</h2>
      <p class="sub">נכסים שנותרו בעת הסגירה ועובדים עשויים להצריך טיפול נוסף.</p>

      <div class="section-title">מלאי וציוד</div>
      ${choiceField("hasStock", "האם נותר מלאי עסקי?", d.hasStock,
        [["yes", "כן, יש מלאי"], ["no", "אין מלאי"]])}
      ${choiceField("hasEquipment", "האם נותר ציוד / רכוש קבוע של העסק?", d.hasEquipment,
        [["yes", "כן, יש ציוד"], ["no", "אין ציוד"]])}
      ${choiceField("businessPremises", "המבנה ששימש את העסק הוא:", d.businessPremises,
        [["owned", "בבעלותי"], ["rented", "בשכירות"]])}

      <div class="reveal ${showAssetDetail ? 'show' : ''}" data-reveal="assets">
        <div class="field full" style="margin-top:14px">
          <label>פירוט המלאי / הציוד <span class="hint">(יסייע בהערכת חבות מע״מ)</span></label>
          <textarea data-key="assetsDetail" placeholder="לדוגמה: מחשב נייד, ציוד צילום, מלאי מוצרים בשווי...">${esc(d.assetsDetail)}</textarea>
        </div>
      </div>

      <div class="section-title">עובדים ותיק ניכויים</div>
      ${choiceField("employees", "האם העסקת עובדים?", d.employees,
        [["yes", "כן, היו עובדים"], ["no", "לא העסקתי עובדים"]])}
      ${choiceField("withholdingFile", "האם קיים תיק ניכויים פעיל?", d.withholdingFile,
        [["yes", "כן"], ["no", "לא"], ["unknown", "לא יודע/ת"]])}

      ${navButtons()}
    </div>`;
  }

  function stepBtl() {
    const d = D();
    return `
    <div class="card">
      <div class="step-eyebrow">שלב 6 מתוך 7 · ${typeLabel()}</div>
      <h2>מעמד בביטוח לאומי</h2>
      <p class="sub">כדי לעדכן נכון את המעמד שלך כעצמאי ולמנוע חיובים מיותרים.</p>

      ${choiceField("alsoEmployee", "האם אתה עובד גם כשכיר במקביל?", d.alsoEmployee,
        [["yes", "כן, גם שכיר"], ["no", "לא, רק עצמאי"]])}

      <div class="reveal ${d.alsoEmployee === 'yes' ? 'show' : ''}" data-reveal="employer">
        <div class="field-grid" style="margin:-4px 0 16px">
          ${textField("employerName", "שם המעביד", d.employerName, false, "למילוי בטופס 2550")}
          ${textField("employerAddress", "כתובת המעביד", d.employerAddress, false)}
        </div>
      </div>

      ${choiceField("otherIncome", "האם קיימות הכנסות נוספות (שכירות, פנסיה, קצבה וכו׳)?", d.otherIncome,
        [["yes", "כן"], ["no", "לא"]])}

      <div class="reveal ${d.otherIncome === 'yes' ? 'show' : ''}" data-reveal="otherinc">
        <div class="field-grid" style="margin:-4px 0 16px">
          ${textField("otherIncomeSource", "מקור ההכנסה הנוספת", d.otherIncomeSource, false, "לדוגמה: שכר דירה")}
          ${textField("otherIncomeAmount", "הכנסה שנתית (₪)", d.otherIncomeAmount, false, "", "inputmode=numeric")}
        </div>
      </div>

      ${choiceField("overpaid", "האם ייתכן ששילמת דמי ביטוח לאומי ביתר השנה?", d.overpaid,
        [["yes", "כן / ייתכן"], ["no", "לא"], ["unknown", "לא יודע/ת"]])}

      <div class="section-title">הערות חופשיות</div>
      <div class="field full">
        <label>משהו נוסף שחשוב לציין? <span class="hint">(לא חובה)</span></label>
        <textarea data-key="notes" placeholder="כל מידע נוסף שרלוונטי לסגירה...">${esc(d.notes)}</textarea>
      </div>

      ${navButtons("להמשך לסקירה ←")}
    </div>`;
  }

  function stepReview() {
    const d = D();
    const row = (label, val) => `<tr><td>${label}</td><td>${esc(val) || "—"}</td></tr>`;
    return `
    <div class="card">
      <div class="step-eyebrow">שלב 7 מתוך 7</div>
      <h2>סקירה ואישור</h2>
      <p class="sub">עבור על הפרטים לפני יצירת המסמכים. אפשר לחזור ולערוך כל שלב.</p>

      <div class="review-group">
        <h3>👤 פרטים אישיים ועסק <button class="edit-link" data-goto="1">עריכה</button></h3>
        <table class="review-table">
          ${row("סוג עסק", typeLabel())}
          ${row("שם מלא", d.fullName)}
          ${row("ת.ז.", d.idNumber)}
          ${row("מספר עוסק", d.osekNumber)}
          ${row("טלפון", d.phone)}
          ${row("דוא״ל", d.email)}
          ${row("שם העסק", d.bizName)}
          ${row("תחום עיסוק", d.bizField)}
          ${row("כתובת העסק", d.bizAddress)}
          ${row("תאריך פתיחה", fmtDate(d.openDate))}
        </table>
      </div>

      <div class="review-group">
        <h3>📅 פעילות <button class="edit-link" data-goto="2">עריכה</button></h3>
        <table class="review-table">
          ${row("תאריך הפסקת פעילות", fmtDate(d.cessationDate))}
          ${row("סיבת ההפסקה", reasonLabel(d.cessationReason))}
          ${row("פעילות בשנת הסגירה", yn(d.activity2026))}
          ${row("הכנסות בשנת הסגירה", yn(d.incomeInClosingYear))}
        </table>
      </div>

      <div class="review-group">
        <h3>💰 כספים ונכסים <button class="edit-link" data-goto="3">עריכה</button></h3>
        <table class="review-table">
          ${row("מסמכים שלא דווחו", yn(d.unreportedDocs))}
          ${row("חובות פתוחים", yn(d.debts))}
          ${d.debts === "yes" ? row("פירוט חובות", d.debtsDetail) : ""}
          ${row("מלאי שנותר", yn(d.hasStock))}
          ${row("ציוד שנותר", yn(d.hasEquipment))}
          ${(d.hasStock === "yes" || d.hasEquipment === "yes") ? row("פירוט נכסים", d.assetsDetail) : ""}
          ${row("העסקת עובדים", yn(d.employees))}
          ${row("תיק ניכויים", yn(d.withholdingFile))}
        </table>
      </div>

      <div class="review-group">
        <h3>🏛️ ביטוח לאומי <button class="edit-link" data-goto="5">עריכה</button></h3>
        <table class="review-table">
          ${row("גם שכיר", yn(d.alsoEmployee))}
          ${row("הכנסות נוספות", yn(d.otherIncome))}
          ${row("אפשרות לתשלום ביתר", yn(d.overpaid))}
          ${d.notes ? row("הערות", d.notes) : ""}
        </table>
      </div>

      <div class="confirm-box">
        <label>
          <input type="checkbox" id="confirmChk" ${S.confirmed ? "checked" : ""} />
          <span>אני מאשר/ת שהפרטים שמילאתי נכונים ומדויקים, ומבין/ה שהשירות מכין עבורי את המסמכים ותוכנית ההגשה בלבד — ההגשה בפועל לרשויות תתבצע על ידי, עם ההזדהות האישית שלי, לאחר שאבדוק את המסמכים.</span>
        </label>
      </div>

      <div class="nav">
        <button class="btn btn-ghost" id="back">→ חזרה</button>
        <button class="btn btn-ok" id="generate" ${S.confirmed ? "" : "disabled"}>✨ צור את המסמכים ותוכנית ההגשה</button>
      </div>
    </div>`;
  }

  /* ---------------- Field builders ---------------- */
  function textField(key, label, val, req, hint, extra) {
    return `<div class="field">
      <label>${label}${req ? '<span class="req">*</span>' : ''} ${hint ? `<span class="hint">${hint}</span>` : ''}</label>
      <input data-key="${key}" value="${esc(val)}" ${extra || ""} ${req ? 'data-req="1"' : ''} />
      <span class="err">שדה חובה</span>
    </div>`;
  }
  function dateField(key, label, val, req, hint) {
    return `<div class="field">
      <label>${label}${req ? '<span class="req">*</span>' : ''} ${hint ? `<span class="hint">${hint}</span>` : ''}</label>
      <input type="date" data-key="${key}" value="${esc(val)}" ${req ? 'data-req="1"' : ''} />
      <span class="err">שדה חובה</span>
    </div>`;
  }
  function choiceField(key, label, val, options) {
    return `<div class="field full" style="margin-bottom:16px" data-choice="${key}">
      <label>${label}</label>
      <div class="choice-row">
        ${options.map(([v, txt]) => `<div class="choice ${val === v ? 'active' : ''} ${v === 'no' ? 'neg' : ''}" data-val="${v}">${txt}</div>`).join("")}
      </div>
    </div>`;
  }
  function navButtons(nextLabel) {
    return `<div class="nav">
      <button class="btn btn-ghost" id="back">→ חזרה</button>
      <button class="btn btn-primary" id="next">${nextLabel || "המשך ←"}</button>
    </div>`;
  }

  /* ========================================================================
     RESULT: action plans, documents, tracking
     ======================================================================== */

  function buildAuthorities() {
    const d = D();
    const cd = fmtDate(d.cessationDate);
    const isMurshe = d.businessType === "murshe";
    const list = [];

    /* ---- מע״מ ---- */
    const vatSteps = [
      `היכנס/י ל<strong>אזור האישי ברשות המסים</strong> עם ההזדהות שלך, לשירות סגירת/ביטול תיק עוסק.`,
      `בחר/י בבקשה לסגירת תיק עוסק והזן/י את <strong>תאריך הפסקת הפעילות: ${cd}</strong>.`
    ];
    if (isMurshe) {
      vatSteps.push(`הגש/י את <strong>דוחות המע״מ התקופתיים האחרונים</strong>, כולל דוח התקופה האחרונה עד למועד הסגירה.`);
      vatSteps.push(`דווח/י על <strong>מלאי וציוד שנותרו</strong> (ייתכן חיוב מע״מ בגין "מכירה רעיונית" של נכסי העסק).`);
    } else {
      vatSteps.push(`ודא/י שהוגשה <strong>הצהרת עוסק פטור שנתית אחרונה</strong> (דיווח מחזור עסקאות) לשנת הפעילות האחרונה.`);
    }
    vatSteps.push(`צרף/י את טופס הבקשה המודפס שהכנו עבורך (ראה/י "הורד מסמך למטה").`);
    vatSteps.push(`<strong>שמור/י את מספר האסמכתה</strong> שמתקבל והעתק/י אותו לטבלת המעקב.`);

    const vatFlags = [];
    if (d.unreportedDocs === "yes") vatFlags.push(["warn", "יש לדווח על כל החשבוניות/הקבלות שטרם דווחו לפני סגירת התיק."]);
    if ((d.hasStock === "yes" || d.hasEquipment === "yes")) vatFlags.push(["warn", "קיים מלאי/ציוד — ייתכן חיוב מע״מ על נכסי העסק. מומלץ להיוועץ ביועץ מס/רו״ח."]);
    if (d.debts === "yes") vatFlags.push(["warn", "קיימים חובות — יש להסדירם; סגירת התיק אינה מוחקת חוב."]);

    list.push({
      key: "vat", cls: "vat", icon: "🧾", name: "מע״מ — רשות המסים",
      tagline: "סגירת תיק עוסק במע״מ",
      steps: vatSteps, flags: vatFlags,
      links: [
        ["שירות סגירת עוסק במע״מ", "https://www.gov.il/he/service/vat-18", true],
        ["כניסה לאזור האישי ברשות המסים", "https://www.gov.il/he/service/entering-personal-area-tax-authority", false]
      ]
    });

    /* ---- מס הכנסה ---- */
    const taxSteps = [
      `היכנס/י לשירות <strong>הודעה על הפסקת פעילות / סגירת תיק</strong> במס הכנסה, או מלא/י את <strong>טופס 2550</strong>.`,
      `הזן/י את <strong>תאריך הפסקת הפעילות: ${cd}</strong>.`,
      `הגש/י <strong>דוח שנתי אחרון</strong> לשנת הפעילות האחרונה (חובה גם לאחר סגירת התיק).`,
      `בטל/י <strong>מקדמות מס</strong> פתוחות, אם קיימות.`,
      `צרף/י את טופס 2550 המודפס שהכנו עבורך.`,
      `<strong>שמור/י את האסמכתה</strong> והעתק/י לטבלת המעקב.`
    ];
    const taxFlags = [["warn", "סגירת התיק אינה מבטלת את חובת הגשת הדוח השנתי האחרון."]];
    if (d.debts === "yes") taxFlags.push(["warn", "קיימים חובות/מקדמות פתוחות — יש להסדיר מול פקיד השומה."]);
    if (d.employees === "yes" || d.withholdingFile === "yes") taxFlags.push(["warn", "קיים תיק ניכויים/עובדים — יש לסגור תיק ניכויים בנפרד ולהנפיק טופסי 106 לעובדים."]);

    list.push({
      key: "tax", cls: "tax", icon: "📊", name: "מס הכנסה — רשות המסים",
      tagline: "טופס 2550 — סגירת תיק עצמאי",
      steps: taxSteps, flags: taxFlags,
      links: [
        ["שירות סגירת תיק (טופס 2550)", "https://www.gov.il/he/service/itc2550", true],
        ["אזור אישי רשות המסים", "https://www.gov.il/he/service/entering-personal-area-tax-authority", false]
      ]
    });

    /* ---- ביטוח לאומי ---- */
    const btlSteps = [
      `היכנס/י לאתר <strong>המוסד לביטוח לאומי</strong> → עדכון מעמד / הפסקת עבודה כעצמאי (טופס דין וחשבון רב-שנתי 6101).`,
      `הזן/י את <strong>תאריך הפסקת הפעילות: ${cd}</strong>.`
    ];
    if (d.alsoEmployee === "yes") btlSteps.push(`ציין/י שאתה ממשיך כ<strong>שכיר</strong> — כדי שהמעמד יתעדכן ל"שכיר בלבד" ולא יישאר "עצמאי".`);
    if (d.otherIncome === "yes") btlSteps.push(`עדכן/י את <strong>ההכנסות הנוספות</strong> הרלוונטיות (שכירות/פנסיה/קצבה).`);
    btlSteps.push(`בקש/י <strong>התאמת מקדמות</strong> / החזר בגין תשלום ביתר, אם רלוונטי.`);
    btlSteps.push(`<strong>ודא/י שהמעמד עודכן</strong> וקבל/י אישור; שמור/י את האסמכתה.`);

    const btlFlags = [];
    if (d.alsoEmployee === "yes") btlFlags.push(["ok", "אתה גם שכיר — ודא שהמעמד אכן השתנה ל'שכיר בלבד' כדי להפסיק חיובי דמי ביטוח כעצמאי."]);
    if (d.overpaid === "yes") btlFlags.push(["ok", "ייתכן שמגיע לך החזר בגין תשלום דמי ביטוח ביתר — בקש/י בדיקת התאמה."]);

    list.push({
      key: "btl", cls: "btl", icon: "🏛️", name: "ביטוח לאומי",
      tagline: "עדכון הפסקת מעמד עצמאי",
      steps: btlSteps, flags: btlFlags,
      links: [
        ["סגירת תיק עצמאי בביטוח לאומי", "https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/close.aspx", true],
        ["אזור אישי ביטוח לאומי", "https://www.btl.gov.il/Pages/default.aspx", false]
      ]
    });

    return list;
  }

  function collectOpenIssues() {
    const d = D();
    const issues = [];
    if (d.unreportedDocs === "yes") issues.push("קיימות חשבוניות/קבלות שטרם דווחו — לדווח לפני הסגירה.");
    if (d.debts === "yes") issues.push("קיימים חובות פתוחים לרשויות — להסדיר בנפרד." + (d.debtsDetail ? ` (${d.debtsDetail})` : ""));
    if (d.hasStock === "yes" || d.hasEquipment === "yes") issues.push("נותרו מלאי/ציוד — לבדוק חבות מע״מ על מכירה רעיונית.");
    if (d.employees === "yes" || d.withholdingFile === "yes") issues.push("תיק ניכויים/עובדים — לסגור בנפרד ולהנפיק טופסי 106.");
    issues.push("חובה להגיש דוח שנתי אחרון במס הכנסה לשנת הפעילות האחרונה.");
    if (d.businessType === "patur") issues.push("לוודא הגשת הצהרת עוסק פטור שנתית אחרונה במע״מ.");
    return issues;
  }

  function manualNote(key) {
    const d = D();
    let items = [];
    if (key === "vat") {
      items = ["חתימה (עמ׳ 2)", "סימון \"נותרו / לא נותרו מלאי ונכסים\" (סעיף ב)"];
      if (d.hasStock === "yes" || d.hasEquipment === "yes") items.push("טבלאות המלאי/הציוד (סעיף ב) — פירוט הפריטים ושוויים");
      if (d.cessationReason === "sold") items.push("סימון \"מכרתי את העסק כולל המלאי\" + פרטי הרוכש");
      items.push("תיבות הצהרה על בעלות בעסק אחר (אם רלוונטי)");
    } else {
      items = ["חתימה", "מספר תיק (בראש הטופס) — אם ידוע לך"];
      if (d.cessationReason === "rentedBusiness") items.push("פרטי השוכר (סעיף \"העסק הושכר\")");
    }
    return `<details class="manual-note"><summary>ℹ️ שדות להשלמה ידנית לפני ההגשה (${items.length})</summary>
      <ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></details>`;
  }

  function stepResult() {
    const auths = buildAuthorities();
    const d = D();

    // ensure tracking entries exist
    auths.forEach(a => { if (!S.tracking[a.key]) S.tracking[a.key] = { status: "not_started", ref: "" }; });
    save();

    const authCards = auths.map(a => `
      <div class="auth-card" data-auth="${a.key}">
        <div class="auth-head">
          <div class="auth-ic ${a.cls}">${a.icon}</div>
          <div class="meta"><h3>${a.name}</h3><p>${a.tagline}</p></div>
          <div class="chev">▼</div>
        </div>
        <div class="auth-body">
          <ol class="step-list">${a.steps.map(s => `<li>${s}</li>`).join("")}</ol>
          ${a.flags.length ? `<div class="flags">${a.flags.map(([t, txt]) => `<div class="flag ${t}"><span>${t === 'warn' ? '⚠️' : '💡'}</span><span>${txt}</span></div>`).join("")}</div>` : ""}
          <div class="doc-links">
            ${a.key === "vat" ? `<button class="doc-link" data-fill="vat" style="background:#16a06a">📥 טופס מע״מ 18 הרשמי — ממולא (PDF)</button>` : ""}
            ${a.key === "tax" ? `<button class="doc-link" data-fill="tax" style="background:#16a06a">📥 טופס 2550 הרשמי — ממולא (PDF)</button>` : ""}
            <button class="doc-link ${(a.key === "vat" || a.key === "tax") ? "sec" : ""}" data-print="${a.key}">🖨️ הורד/הדפס טופס מרוכז</button>
            ${a.links.map(([txt, url, primary]) => `<a class="doc-link sec" href="${url}" target="_blank" rel="noopener">🔗 ${txt}</a>`).join("")}
          </div>
          ${(a.key === "vat" || a.key === "tax") ? manualNote(a.key) : ""}
        </div>
      </div>`).join("");

    const statusOptions = [
      ["not_started", "לא התחיל"], ["waiting_info", "ממתין למידע"], ["ready", "מוכן למילוי"],
      ["waiting_approval", "ממתין לאישור"], ["submitted", "הוגש"], ["in_progress", "בטיפול הרשות"],
      ["need_more", "נדרש מידע נוסף"], ["approved", "אושר"], ["closed", "נסגר סופית"]
    ];
    const pillClass = (st) => ({
      not_started: "gray", waiting_info: "orange", ready: "blue", waiting_approval: "orange",
      submitted: "blue", in_progress: "blue", need_more: "orange", approved: "green", closed: "green"
    }[st] || "gray");
    const stLabel = (st) => (statusOptions.find(o => o[0] === st) || ["", "—"])[1];

    const trackRows = auths.map(a => {
      const tr = S.tracking[a.key];
      return `<tr data-track="${a.key}">
        <td><strong>${a.name.split(" — ")[0]}</strong></td>
        <td>${a.tagline}</td>
        <td>
          <span class="pill ${pillClass(tr.status)}" data-pill>${stLabel(tr.status)}</span>
          <select class="status-select" data-status style="margin-top:6px;display:block">
            ${statusOptions.map(([v, t]) => `<option value="${v}" ${tr.status === v ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </td>
        <td><input class="ref" data-ref placeholder="מספר אסמכתה" value="${esc(tr.ref)}" /></td>
      </tr>`;
    }).join("");

    const issues = collectOpenIssues();

    return `
    <div class="card">
      <div class="summary-hero">
        <div class="big">🎉</div>
        <h2>הכול מוכן, ${esc(d.fullName.split(" ")[0] || "")}!</h2>
        <p class="sub">הכנו עבורך תוכנית הגשה מלאה ל-3 רשויות, טפסים ממולאים להורדה וטבלת מעקב. פעל/י לפי השלבים בכל כרטיס.</p>
      </div>

      <div class="summary-grid">
        <div class="stat"><div class="n">3</div><div class="l">רשויות לטיפול</div></div>
        <div class="stat"><div class="n">${auths.reduce((n, a) => n + a.steps.length, 0)}</div><div class="l">שלבי פעולה</div></div>
        <div class="stat"><div class="n">${issues.length}</div><div class="l">נקודות לתשומת לב</div></div>
      </div>

      <div class="alert alert-info no-print">
        <span class="ai">📄</span>
        <div><strong>הטפסים שלך</strong>לחיצה על "הורד/הדפס" פותחת חלון הדפסה עם הטופס הממולא — בחר/י "שמירה כ-PDF" כיעד ההדפסה כדי לשמור קובץ. אפשר גם <button class="edit-link" id="printAll" style="font-size:14px">להדפיס את כל החבילה יחד</button>.</div>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size:20px">📋 תוכנית ההגשה — לפי רשות</h2>
      <p class="sub">לחץ/י על כל רשות כדי לפתוח את השלבים, הטופס והקישורים הרשמיים.</p>
      ${authCards}
    </div>

    <div class="card">
      <h2 style="font-size:20px">✅ טבלת מעקב</h2>
      <p class="sub">עדכן/י את הסטטוס ואת מספרי האסמכתה ככל שאתה מתקדם. הכול נשמר אוטומטית במכשיר שלך.</p>
      <div class="track-scroll">
        <table class="track">
          <thead><tr><th>רשות</th><th>פעולה</th><th>סטטוס</th><th>אסמכתה</th></tr></thead>
          <tbody>${trackRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size:20px">⚠️ נקודות שחשוב לסגור</h2>
      <p class="sub">ודא/י שטיפלת בכל אחת מהנקודות — חלקן עלולות לעכב את סגירת התיקים.</p>
      <div class="flags">
        ${issues.map(i => `<div class="flag warn"><span>•</span><span>${esc(i)}</span></div>`).join("")}
      </div>
      <div class="alert alert-warn" style="margin-top:18px">
        <span class="ai">👩‍⚖️</span>
        <div><strong>מתי לפנות לרו״ח / יועץ מס?</strong>אם יש חובות משמעותיים, מלאי/ציוד בשווי גבוה, תיק ניכויים פעיל או אי-ודאות לגבי דוחות — מומלץ להיוועץ באיש מקצוע לפני ההגשה.</div>
      </div>
    </div>

    <div class="card no-print" style="text-align:center">
      <div class="doc-links" style="justify-content:center">
        <button class="doc-link" id="printAll2">🖨️ הדפס/שמור את כל החבילה</button>
        <button class="doc-link sec" id="downloadJson">💾 גיבוי הנתונים (JSON)</button>
        <button class="doc-link sec" id="restart">↺ תיק חדש</button>
      </div>
    </div>`;
  }

  /* ========================================================================
     PRINTABLE DOCUMENTS
     ======================================================================== */
  function buildPrintDocs(onlyKey) {
    const d = D();
    const auths = buildAuthorities();
    const header = (title, subtitle) => `
      <div style="border-bottom:3px solid #1f5fd6;padding-bottom:12px;margin-bottom:18px">
        <div style="font-size:13px;color:#1f5fd6;font-weight:700">בקשה לסגירת תיק · ${esc(typeLabel())}</div>
        <div style="font-size:24px;font-weight:800;margin-top:2px">${title}</div>
        <div style="font-size:14px;color:#5a6a7e">${subtitle}</div>
      </div>`;
    const kv = (rows) => `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
      ${rows.filter(Boolean).map(([k, v]) => `<tr>
        <td style="padding:7px 4px;border-bottom:1px solid #e2e8f2;color:#5a6a7e;width:42%">${k}</td>
        <td style="padding:7px 4px;border-bottom:1px solid #e2e8f2;font-weight:700">${esc(v) || "—"}</td></tr>`).join("")}
    </table>`;
    const sign = () => `
      <div style="margin-top:34px;display:flex;justify-content:space-between;font-size:13px;color:#16202e">
        <div>תאריך: <strong>${new Date().toLocaleDateString("he-IL")}</strong></div>
        <div>חתימת מגיש/ה: ________________________</div>
      </div>
      <div style="margin-top:22px;font-size:11px;color:#9aa6b6;border-top:1px dashed #e2e8f2;padding-top:10px">
        מסמך זה הוכן באמצעות "סגירת עסק בקלות" ככלי עזר להגשה. יש להגישו דרך השירות המקוון הרשמי של הרשות עם הזדהות אישית.
      </div>`;

    const docs = {};

    docs.vat = header("מע״מ — בקשה לסגירת תיק עוסק", d.businessType === "murshe" ? "ביטול עוסק מורשה" : "ביטול עוסק פטור") +
      kv([
        ["שם מלא", d.fullName], ["מספר זהות", d.idNumber], ["מספר עוסק", d.osekNumber],
        ["שם העסק", d.bizName], ["תחום עיסוק", d.bizField], ["כתובת העסק", d.bizAddress],
        ["טלפון", d.phone], ["דוא״ל", d.email],
        ["תאריך פתיחת העסק", fmtDate(d.openDate)], ["תאריך הפסקת פעילות", fmtDate(d.cessationDate)],
        ["הכנסות בשנת הסגירה", yn(d.incomeInClosingYear)],
        ["מלאי שנותר", yn(d.hasStock)], ["ציוד שנותר", yn(d.hasEquipment)],
        (d.hasStock === "yes" || d.hasEquipment === "yes") ? ["פירוט מלאי/ציוד", d.assetsDetail] : null
      ]) + sign();

    docs.tax = header("מס הכנסה — הודעה על סגירת תיק (טופס 2550)", "הפסקת פעילות עסק עצמאי") +
      kv([
        ["שם מלא", d.fullName], ["מספר זהות", d.idNumber], ["מספר עוסק/תיק", d.osekNumber],
        ["תחום עיסוק", d.bizField], ["כתובת העסק", d.bizAddress],
        ["טלפון", d.phone], ["דוא״ל", d.email],
        ["תאריך הפסקת פעילות", fmtDate(d.cessationDate)],
        ["הייתה פעילות בשנת הסגירה", yn(d.activity2026)],
        ["היו הכנסות בשנת הסגירה", yn(d.incomeInClosingYear)],
        ["חובות/מקדמות פתוחות", yn(d.debts)],
        ["העסקת עובדים / תיק ניכויים", (d.employees === "yes" || d.withholdingFile === "yes") ? "כן" : "לא"]
      ]) +
      `<div style="font-size:13px;background:#eaf1ff;padding:11px 13px;border-radius:8px;color:#1848a8">
        הערה: יש להגיש דוח שנתי אחרון לשנת הפעילות האחרונה גם לאחר סגירת התיק.</div>` + sign();

    docs.btl = header("ביטוח לאומי — עדכון הפסקת מעמד עצמאי", "דין וחשבון רב-שנתי (טופס 6101)") +
      kv([
        ["שם מלא", d.fullName], ["מספר זהות", d.idNumber],
        ["טלפון", d.phone], ["דוא״ל", d.email],
        ["תאריך הפסקת פעילות כעצמאי", fmtDate(d.cessationDate)],
        ["עובד גם כשכיר", yn(d.alsoEmployee)],
        ["הכנסות נוספות", yn(d.otherIncome)],
        ["בקשת בדיקת תשלום ביתר", yn(d.overpaid)],
        d.notes ? ["הערות", d.notes] : null
      ]) + sign();

    const wrapDoc = (inner) => `<div class="print-doc">${inner}</div>`;

    if (onlyKey) return wrapDoc(docs[onlyKey]);

    // full package: cover + 3 docs + checklist
    const cover = `<div class="print-doc">
      ${header("חבילת סגירת עסק", `${esc(d.fullName)} · ${esc(typeLabel())} · ${esc(d.osekNumber)}`)}
      <p style="font-size:14px;margin-bottom:14px">חבילה זו כוללת את הטפסים לשלוש הרשויות ורשימת משימות. יש להגיש כל טופס דרך השירות המקוון הרשמי של הרשות.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#f3f6fc"><td style="padding:8px;font-weight:700">#</td><td style="padding:8px;font-weight:700">רשות</td><td style="padding:8px;font-weight:700">פעולה</td></tr>
        ${auths.map((a, i) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f2">${i + 1}</td><td style="padding:8px;border-bottom:1px solid #e2e8f2;font-weight:700">${a.name}</td><td style="padding:8px;border-bottom:1px solid #e2e8f2">${a.tagline}</td></tr>`).join("")}
      </table>
      <div style="margin-top:20px;font-size:14px"><strong>נקודות לתשומת לב:</strong>
        <ul style="margin:8px 20px 0">${collectOpenIssues().map(i => `<li style="margin-bottom:4px">${esc(i)}</li>`).join("")}</ul>
      </div>
    </div>`;

    return cover + wrapDoc(docs.vat) + wrapDoc(docs.tax) + wrapDoc(docs.btl);
  }

  function doPrint(onlyKey) {
    printArea.innerHTML = buildPrintDocs(onlyKey);
    setTimeout(() => window.print(), 80);
  }

  /* ========================================================================
     RENDER + EVENTS
     ======================================================================== */
  function render() {
    renderProgress();
    const fns = [stepType, stepDetails, stepActivity, stepFinance, stepAssets, stepBtl, stepReview, stepResult];
    app.innerHTML = fns[S.step]();
    window.scrollTo({ top: 0, behavior: "smooth" });
    bind();
  }

  function readInputs() {
    app.querySelectorAll("[data-key]").forEach(inp => {
      D()[inp.getAttribute("data-key")] = inp.value.trim();
    });
    save();
  }

  function validateStep() {
    let ok = true;
    app.querySelectorAll('[data-req="1"]').forEach(inp => {
      const err = inp.parentElement.querySelector(".err");
      if (!inp.value.trim()) {
        inp.classList.add("invalid"); if (err) err.classList.add("show"); ok = false;
      } else { inp.classList.remove("invalid"); if (err) err.classList.remove("show"); }
    });
    // id number check-digit validation on details step
    if (S.step === 1) {
      const idInp = app.querySelector('[data-key="idNumber"]');
      if (idInp && idInp.value.trim() && !validIsraeliId(idInp.value.trim())) {
        idInp.classList.add("invalid");
        const err = idInp.parentElement.querySelector(".err");
        if (err) { err.textContent = "מספר ת.ז. לא תקין — בדוק/י את הספרות (ספרת ביקורת שגויה)"; err.classList.add("show"); }
        ok = false;
      }
      // osek number: if it equals an ID-length number, validate the check digit too
      const osekInp = app.querySelector('[data-key="osekNumber"]');
      if (osekInp && osekInp.value.trim() && /^\d{9}$/.test(osekInp.value.trim()) && !validIsraeliId(osekInp.value.trim())) {
        osekInp.classList.add("invalid");
        const err = osekInp.parentElement.querySelector(".err");
        if (err) { err.textContent = "מספר עוסק בן 9 ספרות אינו עובר ביקורת — ודא/י שהוא נכון"; err.classList.add("show"); }
        ok = false;
      }
    }
    if (!ok) toast("יש להשלים את שדות החובה המסומנים");
    return ok;
  }

  function go(step) {
    readInputs();
    S.step = Math.max(0, Math.min(STEPS.length - 1, step));
    save(); render();
  }

  function bind() {
    // business type selection
    app.querySelectorAll("[data-type]").forEach(c => c.addEventListener("click", () => {
      D().businessType = c.getAttribute("data-type");
      save(); render();
    }));

    // choice chips
    app.querySelectorAll("[data-choice]").forEach(group => {
      const key = group.getAttribute("data-choice");
      group.querySelectorAll(".choice").forEach(ch => ch.addEventListener("click", () => {
        D()[key] = ch.getAttribute("data-val");
        group.querySelectorAll(".choice").forEach(x => x.classList.remove("active"));
        ch.classList.add("active");
        save();
        handleReveals();
      }));
    });

    // next / back
    const next = app.querySelector("#next");
    if (next) next.addEventListener("click", () => { if (validateStep()) go(S.step + 1); });
    const back = app.querySelector("#back");
    if (back) back.addEventListener("click", () => go(S.step - 1));

    // review edit links
    app.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => go(+b.getAttribute("data-goto"))));

    // confirm checkbox
    const chk = app.querySelector("#confirmChk");
    if (chk) chk.addEventListener("change", () => {
      S.confirmed = chk.checked; save();
      const g = app.querySelector("#generate"); if (g) g.disabled = !chk.checked;
    });
    const gen = app.querySelector("#generate");
    if (gen) gen.addEventListener("click", () => { if (S.confirmed) go(S.step + 1); });

    // ---- result step interactions ----
    app.querySelectorAll(".auth-head").forEach(h => h.addEventListener("click", () => {
      h.closest(".auth-card").classList.toggle("open");
    }));
    app.querySelectorAll("[data-print]").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation(); doPrint(b.getAttribute("data-print"));
    }));
    app.querySelectorAll("[data-fill]").forEach(fb => fb.addEventListener("click", async (e) => {
      e.stopPropagation();
      const kind = fb.getAttribute("data-fill");
      const fn = kind === "tax" ? window.fillOfficialTax : window.fillOfficialVat;
      const label = kind === "tax" ? "טופס 2550" : "טופס מע״מ 18";
      if (!fn) { toast("הרכיב עדיין נטען — נסה/י שוב בעוד רגע"); return; }
      const orig = fb.textContent;
      fb.textContent = "⏳ מכין את הטופס...";
      try { await fn(D()); toast(label + " הרשמי ירד למכשיר"); }
      catch (err) { console.error(err); toast("שגיאה ביצירת הטופס — בדוק/י חיבור לרשת"); }
      finally { fb.textContent = orig; }
    }));
    ["#printAll", "#printAll2"].forEach(sel => {
      const b = app.querySelector(sel); if (b) b.addEventListener("click", () => doPrint(null));
    });
    // tracking updates
    app.querySelectorAll("[data-track]").forEach(row => {
      const key = row.getAttribute("data-track");
      const sel = row.querySelector("[data-status]");
      const pill = row.querySelector("[data-pill]");
      const ref = row.querySelector("[data-ref]");
      if (sel) sel.addEventListener("change", () => {
        S.tracking[key].status = sel.value; save();
        const map = { not_started: ["gray", "לא התחיל"], waiting_info: ["orange", "ממתין למידע"], ready: ["blue", "מוכן למילוי"], waiting_approval: ["orange", "ממתין לאישור"], submitted: ["blue", "הוגש"], in_progress: ["blue", "בטיפול הרשות"], need_more: ["orange", "נדרש מידע נוסף"], approved: ["green", "אושר"], closed: ["green", "נסגר סופית"] };
        const m = map[sel.value];
        pill.className = "pill " + m[0]; pill.textContent = m[1];
        toast("הסטטוס עודכן ונשמר");
      });
      if (ref) ref.addEventListener("input", () => { S.tracking[key].ref = ref.value; save(); });
    });
    const dj = app.querySelector("#downloadJson");
    if (dj) dj.addEventListener("click", downloadJson);
    const rs = app.querySelector("#restart");
    if (rs) rs.addEventListener("click", resetAll);
  }

  function handleReveals() {
    const d = D();
    const map = {
      debts: d.debts === "yes",
      assets: (d.hasStock === "yes" || d.hasEquipment === "yes"),
      sold: d.cessationReason === "sold",
      employer: d.alsoEmployee === "yes",
      otherinc: d.otherIncome === "yes"
    };
    app.querySelectorAll("[data-reveal]").forEach(r => {
      r.classList.toggle("show", !!map[r.getAttribute("data-reveal")]);
    });
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ data: S.data, tracking: S.tracking }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `סגירת-עסק-${S.data.osekNumber || "backup"}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast("קובץ הגיבוי נשמר");
  }

  function resetAll() {
    if (!confirm("לפתוח תיק חדש? כל הנתונים הנוכחיים יימחקו מהמכשיר.")) return;
    S = defaultState(); save(); render(); toast("התחלת תיק חדש");
  }

  document.getElementById("resetBtn").addEventListener("click", resetAll);

  render();
})();
