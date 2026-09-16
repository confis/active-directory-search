# GLILA – אוטומציית SEO/GEO לאתר glila.co.il

שני תהליכי אוטומציה (workflows) ל-**n8n** עבור האתר **glila.co.il** (WordPress):

1. **פרסום מאמר שבועי** – מייצר מאמר SEO בעברית (עד 500 מילים) + תמונה, ומפרסם אותו לאתר.
2. **מעקב מילות חיפוש** – מושך אחת לשבוע את ביצועי מילות החיפוש מ-Google Search Console לגיליון Google Sheets.

## קבצים

| קובץ | מה הוא עושה |
|------|-------------|
| `n8n/weekly-article-publisher.json` | Schedule שבועי → GPT-4o (מאמר) → DALL·E (תמונה) → העלאת מדיה ל-WordPress → יצירת פוסט |
| `n8n/gsc-keyword-tracking.json` | Schedule שבועי → שאילתת Search Console → עיבוד → הוספת שורות ל-Google Sheets |

---

## איך מייבאים ל-n8n

לכל קובץ: ב-n8n לחצו **Workflows → ⋯ → Import from File** ובחרו את קובץ ה-JSON.
לאחר הייבוא צריך לחבר לכל node את ה-Credentials (מוסבר למטה) — הן מסומנות ב-`REPLACE_WITH_...`.

---

## Workflow 1 – פרסום מאמר שבועי

### Credentials נדרשות

1. **OpenAI (Header Auth)** — ב-n8n: *Credentials → New → Header Auth*
   - **Name:** `Authorization`
   - **Value:** `Bearer sk-...` (מפתח ה-API שלכם מ-platform.openai.com)
   - משמש גם למאמר (GPT-4o) וגם לתמונה (DALL·E 3).

2. **WordPress (Basic Auth)** — ב-n8n: *Credentials → New → Basic Auth*
   - **User:** שם משתמש WordPress בעל הרשאת פרסום.
   - **Password:** **Application Password** (לא הסיסמה הרגילה!).
     יוצרים ב-WordPress: `משתמשים → הפרופיל שלי → Application Passwords`, נותנים שם (למשל `n8n`), ומעתיקים את הסיסמה שנוצרת.

### הגדרות לעריכה (node בשם `Config`)

- `siteTopic` — **חובה למלא**: תחום התוכן של האתר (למשל: `טיולים ואטרקציות בגליל`). זה מכתיב על מה ה-AI כותב.
- `wpBaseUrl` — כבר מוגדר ל-`https://glila.co.il`.
- `postStatus` — **`draft`** כברירת מחדל (הפוסט נשמר כטיוטה לבדיקה לפני פרסום). כדי לפרסם אוטומטית שנו ל-`publish`.

### תזמון
כברירת מחדל: **כל יום ראשון ב-08:00**. ניתן לשנות ב-node `Weekly Trigger`.

### מומלץ לפני הפעלה מלאה
הריצו ידנית פעם אחת (**Execute Workflow**) עם `postStatus=draft`, בדקו את הטיוטה ב-WordPress, ורק אז החליטו אם לעבור ל-`publish`.

---

## Workflow 2 – מעקב מילות חיפוש (Google Search Console)

### Credentials נדרשות

1. **Google Search Console (Google OAuth2 API)** — ב-n8n: *Credentials → New → Google OAuth2 API*
   - הוסיפו את ה-**Scope**: `https://www.googleapis.com/auth/webmasters.readonly`
   - החשבון חייב להיות בעל הרשאה לנכס ב-Search Console.

2. **Google Sheets (Google Sheets OAuth2 API)** — ליצירת/עדכון הגיליון.

### הגדרות לעריכה (node בשם `Config`)

- `siteUrl` — מזהה הנכס ב-Search Console:
  - נכס Domain: `sc-domain:glila.co.il` (ברירת המחדל)
  - נכס URL-prefix: `https://glila.co.il/`
- `sheetId` — **חובה למלא**: ה-ID של גיליון Google Sheets שאליו יתווספו הנתונים (החלק ב-URL בין `/d/` ל-`/edit`).
  - צרו גיליון עם לשונית בשם **`Keywords`** ובשורה הראשונה כותרות:
    `fetched_at | period_start | period_end | query | clicks | impressions | ctr | position`
- `rowLimit` — מספר מילות המפתח לשליפה (ברירת מחדל 100).

### תזמון
כברירת מחדל: **כל יום שני ב-09:00**. הנתונים נשלפים לחלון של שבוע שהסתיים לפני 3 ימים (בגלל עיכוב הדיווח של Search Console).

---

## הערות

- הקבצים הם תבניות לייבוא. מזהי ה-Credentials (`REPLACE_WITH_...`) מתעדכנים אוטומטית ברגע שתבחרו credential בכל node אחרי הייבוא.
- אם עברית מ-GPT מגיעה עם עיצוב לא רצוי, אפשר לחדד את ה-prompt ב-node `Generate Article (GPT)`.
- מומלץ להוסיף ב-n8n התראת כשל (Error Trigger / Error Workflow) כדי לקבל התראה אם ריצה נכשלת.
