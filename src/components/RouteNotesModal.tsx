import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { StickyNote, History, Plus, Trash2, Clock, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { toast } from "sonner"

export interface RouteNote {
  id: string
  text: string
  created_at: string
}

export interface RouteChangelog {
  id: string
  text: string
  created_at: string
}

export async function appendChangelog(routeId: string, description: string): Promise<void> {
  try {
    await fetch('/api/route-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        routeId,
        type: 'changelog',
        text: description,
      }),
    })
  } catch {
    // silently fail — changelog is non-critical
  }
}

interface DeliveryPoint { delivery: string }
interface RouteInfo {
  code: string
  shift: string
  deliveryPoints: DeliveryPoint[]
  updatedAt?: string
}

function isDeliveryActive(delivery: string, date: Date = new Date()): boolean {
  const day = date.getDay()
  const dateNum = date.getDate()
  switch (delivery) {
    case 'Daily':   return true
    case 'Alt 1':   return dateNum % 2 !== 0
    case 'Alt 2':   return dateNum % 2 === 0
    case 'Weekday': return day <= 4
    default:        return true
  }
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })
}

function formatExact(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-MY", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  routeId: string
  routeName: string
  routeInfo?: RouteInfo
  initialTab?: "notes" | "changelog" | "info"
}

export function RouteNotesModal({ open, onOpenChange, routeId, routeName, routeInfo, initialTab }: Props) {
  const [tab, setTab] = useState<"notes" | "changelog" | "info">(initialTab ?? "notes")
  const [notes, setNotes] = useState<RouteNote[]>([])
  const [changelog, setChangelog] = useState<RouteChangelog[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset tab when initialTab changes (e.g. opened via Info button)
  useEffect(() => {
    if (open) setTab(initialTab ?? "notes")
  }, [open, initialTab])

  // Load from API when modal opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/route-notes?routeId=${encodeURIComponent(routeId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setNotes(data.notes ?? [])
          setChangelog(data.changelog ?? [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, routeId])

  const addNote = async () => {
    const text = input.trim()
    if (!text) return
    setSaving(true)
    const newNote: RouteNote = {
      id: crypto.randomUUID(),
      text,
      created_at: new Date().toISOString(),
    }
    try {
      await fetch('/api/route-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newNote.id, routeId, type: 'note', text }),
      })
      setNotes(prev => [newNote, ...prev])
      setInput("")
      textareaRef.current?.focus()
      toast.success("Note added", {
        description: text.length > 60 ? text.slice(0, 60) + "…" : text,
        icon: <CheckCircle2 className="size-4 text-primary" />,
        duration: 3000,
      })
    } catch {
      toast.error("Failed to save note", {
        description: "Could not reach the server. Please try again.",
        icon: <AlertCircle className="size-4" />,
        duration: 4000,
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id: string) => {
    const target = notes.find(n => n.id === id)
    setNotes(prev => prev.filter(n => n.id !== id))
    try {
      await fetch(`/api/route-notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      toast.success("Note deleted", {
        description: target ? (target.text.length > 60 ? target.text.slice(0, 60) + "…" : target.text) : "Note has been removed.",
        icon: <Trash2 className="size-4 text-primary" />,
        duration: 3000,
      })
    } catch {
      // revert on failure
      const res = await fetch(`/api/route-notes?routeId=${encodeURIComponent(routeId)}`)
      const data = await res.json()
      if (data.success) setNotes(data.notes ?? [])
      toast.error("Failed to delete note", {
        description: "Could not reach the server. Note has been restored.",
        icon: <AlertCircle className="size-4" />,
        duration: 4000,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl flex flex-col" style={{ maxHeight: "85dvh" }}>
        <DialogHeader className="px-4 pt-4 pb-0 shrink-0">
          <DialogTitle className="text-sm font-semibold truncate">{routeName}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex px-4 pt-3 gap-1 shrink-0">
          <button
            onClick={() => setTab("notes")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === "notes"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <StickyNote className="size-3.5" />
            Notes
            {notes.length > 0 && (
              <span className={`text-[10px] px-1 rounded-full ${tab === "notes" ? "bg-background/20" : "bg-muted-foreground/20"}`}>
                {notes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("changelog")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === "changelog"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <History className="size-3.5" />
            Changelog
            {changelog.length > 0 && (
              <span className={`text-[10px] px-1 rounded-full ${tab === "changelog" ? "bg-background/20" : "bg-muted-foreground/20"}`}>
                {changelog.length}
              </span>
            )}
          </button>
          {routeInfo && (
            <button
              onClick={() => setTab("info")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === "info"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Info className="size-3.5" />
              Info
            </button>
          )}
        </div>

        <div className="h-px bg-border/50 mx-4 mt-2 shrink-0" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : tab === "notes" ? (
            <div className="flex flex-col h-full">
              {/* Note list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {notes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <StickyNote className="size-8 opacity-25" />
                    <p className="text-sm">No notes yet</p>
                    <p className="text-xs opacity-60">Add a note below</p>
                  </div>
                ) : (
                  notes.map(note => (
                    <div key={note.id} className="bg-muted/40 rounded-xl px-3 py-2.5 group relative">
                      <p className="text-sm text-foreground whitespace-pre-wrap pr-6">{note.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Clock className="size-2.5" />
                        <span title={formatExact(note.created_at)}>{formatTime(note.created_at)}</span>
                      </p>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t border-border/50 shrink-0 space-y-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote()
                  }}
                  placeholder="Write a note… (Ctrl+Enter to add)"
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-xl bg-muted/50 resize-none outline-none ring-1 ring-border/50 focus:ring-primary/40 placeholder:text-muted-foreground/40 transition-shadow"
                />
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={addNote}
                  disabled={!input.trim() || saving}
                >
                  {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Plus className="size-3.5 mr-1" />}
                  Add Note
                </Button>
              </div>
            </div>
          ) : tab === "changelog" ? (
            // changelog
            <div className="px-4 py-3 space-y-2">
              {changelog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <History className="size-8 opacity-25" />
                  <p className="text-sm">No changes recorded yet</p>
                  <p className="text-xs opacity-60">Changes are recorded when you save</p>
                </div>
              ) : (
                changelog.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center shrink-0 mt-1">
                      <div className={`size-2 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`} />
                      {i < changelog.length - 1 && <div className="w-px flex-1 bg-border/50 mt-1 mb-0" style={{ minHeight: "20px" }} />}
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-[12px] text-foreground leading-snug">{entry.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="size-2.5" />
                        <span title={formatExact(entry.created_at)}>{formatTime(entry.created_at)}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : routeInfo ? (
            // info tab
            <div className="px-4 py-4 space-y-3">
              {/* Active today */}
              {(() => {
                const total = routeInfo.deliveryPoints.length
                const active = routeInfo.deliveryPoints.filter(p => isDeliveryActive(p.delivery)).length
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Active today</span>
                      <span className="text-xs font-semibold text-foreground">
                        {active} <span className="font-normal text-muted-foreground/60">/ {total}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: total ? `${(active / total) * 100}%` : '0%' }} />
                    </div>
                  </>
                )
              })()}

              {/* Delivery type breakdown */}
              {(['Daily','Weekday','Alt 1','Alt 2'] as const).map(type => {
                const count = routeInfo.deliveryPoints.filter(p => p.delivery === type).length
                if (!count) return null
                const dot: Record<string, string> = { 'Daily': 'bg-green-500', 'Weekday': 'bg-blue-500', 'Alt 1': 'bg-orange-500', 'Alt 2': 'bg-purple-500' }
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot[type]}`} />
                      <span className="text-xs text-muted-foreground">{type}</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">{count}</span>
                  </div>
                )
              })}

              {/* Updated */}
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-xs text-muted-foreground">Last updated</span>
                <span className="text-xs text-muted-foreground/70">{formatRelativeTime(routeInfo.updatedAt)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
