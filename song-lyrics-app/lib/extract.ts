import * as cheerio from "cheerio";
import OpenAI from "openai";

export type ExtractedSong = {
  title: string;
  artist: string;
  lyrics: string;
  chorus: string;
};

// Fetch the page at `url` and return a cleaned-up text version of its body,
// stripping scripts/styles/nav so the model gets mostly the real content.
async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // A generic UA; many lyrics sites block obvious bots.
      "User-Agent":
        "Mozilla/5.0 (compatible; LyricsCollector/1.0; +https://example.com)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`לא הצלחתי להוריד את העמוד (סטטוס ${res.status})`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, header, footer, nav").remove();

  const pageTitle = $("title").first().text().trim();
  // Collapse whitespace but keep line breaks, which matter for lyrics.
  const bodyText = $("body")
    .text()
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `PAGE TITLE: ${pageTitle}\n\n${bodyText}`.slice(0, 16000);
}

// Very small fallback used when no OpenAI key is configured: just keep the
// page text so the app is still usable for testing/local dev.
function fallbackExtract(url: string, pageText: string): ExtractedSong {
  const titleMatch = pageText.match(/PAGE TITLE: (.*)/);
  return {
    title: (titleMatch?.[1] || "שיר ללא שם").slice(0, 120),
    artist: "",
    lyrics: pageText.replace(/^PAGE TITLE: .*\n\n/, "").slice(0, 6000),
    chorus: "",
  };
}

export async function extractSongFromUrl(url: string): Promise<ExtractedSong> {
  const pageText = await fetchPageText(url);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackExtract(url, pageText);
  }

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "אתה עוזר שמחלץ מילות שירים מתוך טקסט של עמוד אינטרנט. " +
          "מצא את מילות השיר המלאות, את שם השיר ואת שם האמן, וזהה את הפזמון. " +
          "החזר אך ורק JSON תקין במבנה: " +
          '{"title": string, "artist": string, "lyrics": string, "chorus": string}. ' +
          "השדה lyrics מכיל את כל מילות השיר כפי שהן, עם שבירות שורה (\\n). " +
          "השדה chorus מכיל את הפזמון החוזר בלבד (אם מופיע כמה פעמים – פעם אחת). " +
          "אל תמציא מילים שלא קיימות בטקסט. אם אין מילות שיר בעמוד, החזר lyrics ריק. " +
          "אל תוסיף טקסט מחוץ ל-JSON.",
      },
      {
        role: "user",
        content: `כתובת העמוד: ${url}\n\nתוכן העמוד:\n${pageText}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Partial<ExtractedSong>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallbackExtract(url, pageText);
  }

  const lyrics = (parsed.lyrics || "").trim();
  if (!lyrics) {
    throw new Error(
      "לא נמצאו מילות שיר בעמוד הזה. נסה לינק ישיר לעמוד של מילות השיר."
    );
  }

  return {
    title: (parsed.title || "שיר ללא שם").trim().slice(0, 200),
    artist: (parsed.artist || "").trim().slice(0, 200),
    lyrics,
    chorus: (parsed.chorus || "").trim(),
  };
}
