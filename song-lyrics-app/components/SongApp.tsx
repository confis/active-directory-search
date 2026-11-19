"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Song = {
  id: string;
  title: string;
  artist: string | null;
  source_url: string | null;
  lyrics: string;
  chorus: string | null;
  position: number;
};

type EditFields = {
  title: string;
  artist: string;
  chorus: string;
  lyrics: string;
};

export default function SongApp() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/songs");
      const data = await res.json();
      setSongs(data.songs || []);
    } catch {
      setError("לא הצלחתי לטעון את רשימת השירים");
    }
  }

  async function addSong(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = url.trim();
    if (!value) return;
    setLoading(true);
    try {
      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בהוספת השיר");
      } else {
        setSongs((prev) => [...prev, data.song]);
        setUrl("");
        setOpenId(data.song.id);
      }
    } catch {
      setError("שגיאת רשת — נסו שוב");
    } finally {
      setLoading(false);
    }
  }

  async function removeSong(id: string) {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/songs/${id}`, { method: "DELETE" });
  }

  // Save edits for a song. Returns an error message, or null on success.
  async function saveSong(
    id: string,
    fields: EditFields
  ): Promise<string | null> {
    try {
      const res = await fetch(`/api/songs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "שגיאה בשמירת השיר";
      setSongs((prev) => prev.map((s) => (s.id === id ? data.song : s)));
      return null;
    } catch {
      return "שגיאת רשת — נסו שוב";
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = songs.findIndex((s) => s.id === active.id);
    const newIndex = songs.findIndex((s) => s.id === over.id);
    const next = arrayMove(songs, oldIndex, newIndex);
    setSongs(next);
    await fetch("/api/songs/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((s) => s.id) }),
    });
  }

  return (
    <>
      <form className="add-box" onSubmit={addSong}>
        <input
          type="url"
          inputMode="url"
          dir="ltr"
          placeholder="https://... לינק לעמוד מילות השיר"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <button className="btn-add" type="submit" disabled={loading}>
          {loading ? (
            <>
              מחלץ מילים<span className="spinner" />
            </>
          ) : (
            "הוסף שיר"
          )}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
      <div className="hint">
        טיפ: הדביקו לינק ישיר לעמוד של מילות השיר (למשל Shironet או Genius).
      </div>

      {songs.length === 0 ? (
        <div className="empty">עדיין אין שירים ברשימה. הוסיפו את הראשון ☝️</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={songs.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="list">
              {songs.map((song, i) => (
                <SortableCard
                  key={song.id}
                  song={song}
                  index={i}
                  open={openId === song.id}
                  onToggle={() =>
                    setOpenId(openId === song.id ? null : song.id)
                  }
                  onDelete={() => removeSong(song.id)}
                  onSave={saveSong}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}

function SortableCard({
  song,
  index,
  open,
  onToggle,
  onDelete,
  onSave,
}: {
  song: Song;
  index: number;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (id: string, fields: EditFields) => Promise<string | null>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [fields, setFields] = useState<EditFields>({
    title: song.title,
    artist: song.artist || "",
    chorus: song.chorus || "",
    lyrics: song.lyrics,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function startEdit() {
    setFields({
      title: song.title,
      artist: song.artist || "",
      chorus: song.chorus || "",
      lyrics: song.lyrics,
    });
    setEditErr(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setEditErr(null);
    const err = await onSave(song.id, fields);
    setSaving(false);
    if (err) {
      setEditErr(err);
    } else {
      setEditing(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card${isDragging ? " dragging" : ""}`}
    >
      <div className="card-head">
        <span
          className="handle"
          title="גררו כדי לסדר"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
        <span className="num">{index + 1}</span>
        <div className="titles" onClick={onToggle} style={{ cursor: "pointer" }}>
          <div className="t">{song.title}</div>
          {song.artist && <div className="a">{song.artist}</div>}
        </div>
        <div className="card-actions">
          {!editing && (
            <button className="icon-btn" onClick={startEdit} title="ערוך">
              ערוך
            </button>
          )}
          <button className="icon-btn" onClick={onToggle}>
            {open ? "סגור" : "מילים"}
          </button>
          <button className="icon-btn danger" onClick={onDelete} title="מחק">
            מחק
          </button>
        </div>
      </div>

      {(open || editing) && (
        <div className="card-body">
          {editing ? (
            <div className="edit-form">
              <label>
                <span>שם השיר</span>
                <input
                  type="text"
                  value={fields.title}
                  onChange={(e) =>
                    setFields({ ...fields, title: e.target.value })
                  }
                />
              </label>
              <label>
                <span>אמן</span>
                <input
                  type="text"
                  value={fields.artist}
                  onChange={(e) =>
                    setFields({ ...fields, artist: e.target.value })
                  }
                />
              </label>
              <label>
                <span>פזמון</span>
                <textarea
                  rows={4}
                  value={fields.chorus}
                  onChange={(e) =>
                    setFields({ ...fields, chorus: e.target.value })
                  }
                />
              </label>
              <label>
                <span>מילים</span>
                <textarea
                  rows={10}
                  value={fields.lyrics}
                  onChange={(e) =>
                    setFields({ ...fields, lyrics: e.target.value })
                  }
                />
              </label>
              {editErr && <div className="error">{editErr}</div>}
              <div className="edit-actions">
                <button
                  className="btn-add"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      שומר<span className="spinner" />
                    </>
                  ) : (
                    "שמור"
                  )}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <>
              {song.chorus && (
                <div className="chorus">
                  <div className="label">פזמון</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{song.chorus}</div>
                </div>
              )}
              <div className="lyrics">{song.lyrics}</div>
              {song.source_url && (
                <div className="src">
                  מקור:{" "}
                  <a
                    href={song.source_url}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                  >
                    {song.source_url}
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
