import { NextResponse } from "next/server";
import db, { ready } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body: { order: string[] }  — array of song ids in the new display order.
export async function PATCH(req: Request) {
  await ready();

  let body: { order?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const order = body.order;
  if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) {
    return NextResponse.json(
      { error: "חסר מערך סדר תקין" },
      { status: 400 }
    );
  }

  const statements = order.map((id, index) => ({
    sql: "UPDATE songs SET position = ? WHERE id = ?",
    args: [index, id] as [number, string],
  }));

  if (statements.length > 0) {
    await db.batch(statements, "write");
  }

  return NextResponse.json({ ok: true });
}
