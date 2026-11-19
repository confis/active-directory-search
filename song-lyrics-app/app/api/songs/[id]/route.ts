import { NextResponse } from "next/server";
import db, { ready } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ready();
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM songs WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}

// Edit a song's text fields: title, artist, lyrics, chorus.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ready();
  const { id } = await params;

  let body: {
    title?: string;
    artist?: string;
    lyrics?: string;
    chorus?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const lyrics = (body.lyrics ?? "").trim();
  if (!title || !lyrics) {
    return NextResponse.json(
      { error: "שם השיר ומילות השיר הם שדות חובה" },
      { status: 400 }
    );
  }

  const artist = (body.artist ?? "").trim();
  const chorus = (body.chorus ?? "").trim();

  const res = await db.execute({
    sql: "UPDATE songs SET title = ?, artist = ?, lyrics = ?, chorus = ? WHERE id = ?",
    args: [title, artist, lyrics, chorus, id],
  });

  if (res.rowsAffected === 0) {
    return NextResponse.json({ error: "השיר לא נמצא" }, { status: 404 });
  }

  const updated = await db.execute({
    sql: "SELECT * FROM songs WHERE id = ?",
    args: [id],
  });

  return NextResponse.json({ song: updated.rows[0] });
}
