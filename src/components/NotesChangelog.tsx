import { useState, useEffect, useRef } from "react"
import { useEditMode } from "@/contexts/EditModeContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Plus, Trash2, Pin, PinOff, Loader2,
  StickyNote, History, ChevronDown, ChevronUp,
  Tag, User, Calendar, Sparkles, Wrench, Zap, XCircle,
  TrendingUp, AlertTriangle, Star,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────

interface NoteEntry {
  id: string
  type: "note" | "changelog"
  title: string
  content: string
  version: string | null
  author: string
  pinned: boolean
  created_at: string
  updated_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function NoteCard({
  note,
  isEditMode,
  onDelete,
  onTogglePin,
}: {
  note: NoteEntry
  isEditMode: boolean
  onDelete: (id: string) => void
  onTogglePin: (note: NoteEntry) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = note.content.length > 200

  return (
    <div
      className={`
        relative rounded-xl border bg-card text-card-foreground shadow-sm
        transition-all duration-200 hover:shadow-md
        ${note.pinned ? "border-yellow-400 dark:border-yellow-500 bg-yellow-50/40 dark:bg-yellow-900/10" : ""}
      `}
    >
      {note.pinned && (
        <span className="absolute -top-2 left-3 flex items-center gap-1 rounded-full bg-yellow-400 dark:bg-yellow-500 px-2 py-0.5 text-[10px] font-semibold text-yellow-900 shadow">
          <Pin className="size-2.5" /> Pinned
        </span>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm leading-snug flex-1">
            {note.title || <span className="text-muted-foreground italic">Untitled</span>}
          </h3>
          {isEditMode && (
            <div className="flex items-center gap-1 shrink-0 -mt-0.5">
              <button
                onClick={() => onTogglePin(note)}
                title={note.pinned ? "Unpin" : "Pin"}
                className="rounded p-1 text-muted-foreground hover:text-yellow-500 hover:bg-muted transition-colors"
              >
                {note.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              </button>
              <button
                onClick={() => onDelete(note.id)}
                title="Delete"
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        <div
          className={`text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed ${!expanded && isLong ? "line-clamp-4" : ""}`}
        >
          {note.content}
        </div>

        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? <><ChevronUp className="size-3" /> Show less</> : <><ChevronDown className="size-3" /> Show more</>}
          </button>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <User className="size-3" /> {note.author}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" /> {formatDateTime(note.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Changelog helpers ───────────────────────────────────────────────────────

type ChangeType = "feat" | "fix" | "improve" | "break" | "remove" | "note" | "plain"

interface ParsedLine {
  type: ChangeType
  text: string
  isHeader: boolean
}

function parseChangeType(raw: string): { type: ChangeType; text: string } {
  const prefixes: [RegExp, ChangeType][] = [
    [/^(feat|feature|new)\s*[:：]/i,    "feat"],
    [/^(fix|bug|bugfix|patch)\s*[:：]/i,"fix"],
    [/^(improve|update|enhance|chore)\s*[:：]/i, "improve"],
    [/^(break|breaking)\s*[:：]/i,      "break"],
    [/^(remove|delete|drop)\s*[:：]/i,  "remove"],
    [/^(note|info|docs?)\s*[:：]/i,     "note"],
  ]
  for (const [re, type] of prefixes) {
    if (re.test(raw)) return { type, text: raw.replace(re, "").trim() }
  }
  return { type: "plain", text: raw }
}

function changeTypeStyle(type: ChangeType) {
  switch (type) {
    case "feat":    return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", dot: "bg-emerald-500", Icon: Sparkles }
    case "fix":     return { color: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-900/20",       dot: "bg-rose-500",     Icon: Wrench  }
    case "improve": return { color: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-50 dark:bg-sky-900/20",         dot: "bg-sky-500",      Icon: TrendingUp }
    case "break":   return { color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20",     dot: "bg-amber-500",    Icon: AlertTriangle }
    case "remove":  return { color: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-800/40",    dot: "bg-slate-400",    Icon: XCircle }
    case "note":    return { color: "text-violet-600 dark:text-violet-400",   bg: "bg-violet-50 dark:bg-violet-900/20",   dot: "bg-violet-500",   Icon: Zap }
    default:        return { color: "text-muted-foreground",                  bg: "",                                     dot: "bg-primary/40",   Icon: null   }
  }
}

function versionBadgeStyle(version: string | null) {
  if (!version) return { label: "", cls: "bg-primary/10 text-primary" }
  const parts = version.split(".")
  const major = parseInt(parts[0] ?? "0", 10)
  const minor = parseInt(parts[1] ?? "0", 10)
  if (major > 0 && minor === 0 && (parts[2] === "0" || !parts[2]))
    return { label: `v${version}`, cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-700" }
  if (minor > 0 && (parts[2] === "0" || !parts[2]))
    return { label: `v${version}`, cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-700" }
  return { label: `v${version}`, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700" }
}

function parseLines(content: string): ParsedLine[] {
  return content
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const isBullet = l.startsWith("-") || l.startsWith("•") || l.startsWith("*")
      const raw = isBullet ? l.slice(1).trim() : l
      if (!isBullet) return { type: "plain" as ChangeType, text: raw, isHeader: true }
      const { type, text } = parseChangeType(raw)
      return { type, text, isHeader: false }
    })
}

function ChangelogCard({
  entry,
  isEditMode,
  onDelete,
  isLatest,
}: {
  entry: NoteEntry
  isEditMode: boolean
  onDelete: (id: string) => void
  isLatest: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const lines = parseLines(entry.content)
  const visibleLines = expanded ? lines : lines.slice(0, 5)
  const hasMore = lines.length > 5
  const badge = versionBadgeStyle(entry.version)

  return (
    <div className="relative flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center shrink-0 pt-5">
        <div className={`size-2.5 rounded-full shrink-0 ring-2 ring-background ${isLatest ? "bg-primary" : "bg-border"}`} />
        <div className="flex-1 w-px bg-border mt-1" />
      </div>

      {/* Card */}
      <div className={`
        flex-1 mb-4 rounded-xl border bg-card text-card-foreground shadow-sm
        transition-all duration-200 hover:shadow-md
        ${isLatest ? "border-primary/30" : ""}
      `}>
        <div className="p-4">
          {/* Top row: version + latest badge + title + delete */}
          <div className="flex items-start gap-2 mb-3">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {entry.version && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${badge.cls}`}>
                    <Tag className="size-2.5" /> {badge.label}
                  </span>
                )}
                {isLatest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                    <Star className="size-2.5" /> Latest
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-sm leading-snug">
                {entry.title || <span className="text-muted-foreground italic">Untitled update</span>}
              </h3>
            </div>
            {isEditMode && (
              <button
                onClick={() => onDelete(entry.id)}
                title="Delete"
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors shrink-0 -mt-0.5"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          {/* Change lines */}
          <ul className="space-y-1.5">
            {visibleLines.map((line, i) => {
              if (line.isHeader) return (
                <li key={i} className="font-medium text-sm text-foreground">{line.text}</li>
              )
              const style = changeTypeStyle(line.type)
              const Icon = style.Icon
              return (
                <li key={i} className={`flex items-start gap-1.5 text-sm rounded-md px-2 py-0.5 ${style.bg}`}>
                  {Icon
                    ? <Icon className={`mt-0.5 size-3 shrink-0 ${style.color}`} />
                    : <span className={`mt-2 size-1.5 rounded-full shrink-0 ${style.dot}`} />
                  }
                  <span className={style.color}>{line.text}</span>
                </li>
              )
            })}
          </ul>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {expanded
                ? <><ChevronUp className="size-3" /> Show less</>
                : <><ChevronDown className="size-3" /> {lines.length - 5} more change{lines.length - 5 !== 1 ? "s" : ""}</>}
            </button>
          )}

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/70 border-t border-border/50 pt-2">
            <span className="flex items-center gap-1">
              <User className="size-3" /> {entry.author}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {formatDate(entry.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Note Form ───────────────────────────────────────────────────────────

function AddNoteForm({
  onAdd,
  loading,
}: {
  onAdd: (data: { title: string; content: string; author: string; pinned: boolean }) => Promise<void>
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [author, setAuthor] = useState("Admin")
  const [pinned, setPinned] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!content.trim()) return
    await onAdd({ title, content, author, pinned })
    setTitle("")
    setContent("")
    setPinned(false)
    setOpen(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setTimeout(() => textRef.current?.focus(), 50) }}>
        <Plus className="size-3.5 mr-1" /> Add Note
      </Button>
    )
  }

  return (
    <div className="rounded-xl border bg-muted/40 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <h4 className="text-sm font-semibold">New Note</h4>
      <Input
        placeholder="Title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="text-sm"
      />
      <textarea
        ref={textRef}
        placeholder="Write your note here…"
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none outline-none ring-0 focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60 transition-all"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Author"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          className="text-sm max-w-[140px]"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="rounded" />
          Pin to top
        </label>
        <div className="flex gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !content.trim()}>
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Changelog Form ──────────────────────────────────────────────────────

function AddChangelogForm({
  onAdd,
  loading,
}: {
  onAdd: (data: { title: string; content: string; version: string; author: string }) => Promise<void>
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [version, setVersion] = useState("")
  const [author, setAuthor] = useState("Admin")
  const textRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!content.trim()) return
    await onAdd({ title, content, version, author })
    setTitle("")
    setContent("")
    setVersion("")
    setOpen(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setTimeout(() => textRef.current?.focus(), 50) }}>
        <Plus className="size-3.5 mr-1" /> Add Changelog
      </Button>
    )
  }

  return (
    <div className="rounded-xl border bg-muted/40 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <h4 className="text-sm font-semibold">New Changelog Entry</h4>
      <div className="flex gap-2">
        <Input
          placeholder="Version (e.g. 1.2.0)"
          value={version}
          onChange={e => setVersion(e.target.value)}
          className="text-sm max-w-[160px]"
        />
        <Input
          placeholder="Title / Summary"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-sm flex-1"
        />
      </div>
      <textarea
        ref={textRef}
        placeholder={"List changes, one per line:\n- Fixed delivery map loading\n- Added dark mode support"}
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={5}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none outline-none ring-0 focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60 transition-all"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Author"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          className="text-sm max-w-[140px]"
        />
        <div className="flex gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !content.trim()}>
            {loading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = "notes" | "changelog"

export function NotesChangelog() {
  const { isEditMode } = useEditMode()
  const [tab, setTab] = useState<Tab>("notes")
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [changelogs, setChangelogs] = useState<NoteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notes")
      const json = await res.json()
      if (json.success) {
        const all: NoteEntry[] = json.data
        setNotes(all.filter(n => n.type === "note"))
        setChangelogs(all.filter(n => n.type === "changelog"))
      }
    } catch {
      toast.error("Failed to load notes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // ── Add ──────────────────────────────────────────────────────────────────
  const handleAddNote = async (data: {
    title: string; content: string; author: string; pinned: boolean
  }) => {
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: uid(), type: "note", ...data }),
      })
      const json = await res.json()
      if (json.success) { toast.success("Note saved"); await fetchAll() }
      else toast.error(json.error ?? "Failed to save")
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }

  const handleAddChangelog = async (data: {
    title: string; content: string; version: string; author: string
  }) => {
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: uid(), type: "changelog", ...data }),
      })
      const json = await res.json()
      if (json.success) { toast.success("Changelog entry saved"); await fetchAll() }
      else toast.error(json.error ?? "Failed to save")
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Deleted"); await fetchAll() }
      else toast.error(json.error ?? "Failed to delete")
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }

  // ── Toggle pin ────────────────────────────────────────────────────────────
  const handleTogglePin = async (note: NoteEntry) => {
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...note, pinned: !note.pinned }),
      })
      const json = await res.json()
      if (json.success) { await fetchAll() }
      else toast.error(json.error ?? "Failed to update")
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-1 flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full overflow-y-auto"
      style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
    >
      {/* Header */}
      <div>
        <h1 className="text-fluid-xl page-header font-bold text-gray-900 dark:text-white">
          Notes &amp; Changelog
        </h1>
        <p className="text-fluid-sm page-subheader text-muted-foreground mt-1">
          Public notes and update history visible to all users.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        {(["notes", "changelog"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`
              flex items-center gap-1.5 pb-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px bg-transparent border-x-transparent border-t-transparent
              ${tab === t
                ? "border-b-primary text-primary"
                : "border-b-transparent text-muted-foreground"}
            `}
          >
            {t === "notes" ? <StickyNote className="size-3.5" /> : <History className="size-3.5" />}
            {t === "notes" ? "Notes" : "Changelog"}
            {!loading && (
              <span className={`ml-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tab === t ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {t === "notes" ? notes.length : changelogs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Loading…
        </div>
      ) : tab === "notes" ? (
        // ── Notes Tab ───────────────────────────────────────────────────────
        <div className="flex flex-col gap-3">
          {isEditMode && (
            <AddNoteForm onAdd={handleAddNote} loading={saving} />
          )}
          {notes.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-muted-foreground text-sm">
              No notes yet.
              {isEditMode && " Click \"Add Note\" to create one."}
            </div>
          ) : (
            notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                isEditMode={isEditMode}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
              />
            ))
          )}
        </div>
      ) : (
        // ── Changelog Tab ────────────────────────────────────────────────────
        <div className="flex flex-col gap-0">
          {isEditMode && (
            <div className="mb-3">
              <AddChangelogForm onAdd={handleAddChangelog} loading={saving} />
            </div>
          )}
          {changelogs.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-muted-foreground text-sm">
              No changelog entries yet.
              {isEditMode && " Click \"Add Changelog\" to create one."}
            </div>
          ) : (
            <div className="pl-1">
              {changelogs.map((entry, idx) => (
                <ChangelogCard
                  key={entry.id}
                  entry={entry}
                  isEditMode={isEditMode}
                  onDelete={handleDelete}
                  isLatest={idx === 0}
                />
              ))}
              {/* Timeline end cap */}
              <div className="flex gap-3 pl-[5px]">
                <div className="size-2 rounded-full bg-border shrink-0" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
