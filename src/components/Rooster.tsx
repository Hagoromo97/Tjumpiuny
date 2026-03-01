import { useState, useMemo, useEffect, useCallback } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock,
  CalendarDays,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { useEditMode } from "@/contexts/EditModeContext"

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Resource {
  id: string
  name: string
  role: string
  color: string
}

interface Shift {
  id: string
  resourceId: string
  title: string
  date: string   // "YYYY-MM-DD"
  startHour: number  // 0-23
  endHour: number    // 1-24
  color: string
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
]

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12 AM"
  if (i < 12) return `${i} AM`
  if (i === 12) return "12 PM"
  return `${i - 12} PM`
})

const RESOURCE_COLORS = [
  "#3B82F6", "#F97316", "#22C55E", "#A855F7",
  "#EC4899", "#EAB308", "#14B8A6", "#EF4444",
]

const SHIFT_COLORS = [
  { label: "Blue",   value: "#3B82F6" },
  { label: "Green",  value: "#22C55E" },
  { label: "Orange", value: "#F97316" },
  { label: "Purple", value: "#A855F7" },
  { label: "Pink",   value: "#EC4899" },
  { label: "Teal",   value: "#14B8A6" },
  { label: "Red",    value: "#EF4444" },
  { label: "Yellow", value: "#EAB308" },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getWeekDates(baseDate: Date): Date[] {
  const d = new Date(baseDate)
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - day) // go to Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d)
    nd.setDate(d.getDate() + i)
    return nd
  })
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatHour(h: number) {
  if (h === 0) return "12:00 AM"
  if (h < 12) return `${h}:00 AM`
  if (h === 12) return "12:00 PM"
  return `${h - 12}:00 PM`
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────

async function apiFetchAll(): Promise<{ resources: Resource[]; shifts: Shift[] }> {
  try {
    const res = await fetch("/api/rooster")
    const json = await res.json()
    if (!json.success) return { resources: [], shifts: [] }
    const resources: Resource[] = json.resources.map((r: Record<string, string>) => ({
      id: r.id, name: r.name, role: r.role, color: r.color,
    }))
    const shifts: Shift[] = json.shifts.map((s: Record<string, string | number>) => ({
      id: String(s.id),
      resourceId: String(s.resource_id),
      title: String(s.title),
      date: String(s.shift_date).slice(0, 10),
      startHour: Number(s.start_hour),
      endHour: Number(s.end_hour),
      color: String(s.color),
    }))
    return { resources, shifts }
  } catch {
    return { resources: [], shifts: [] }
  }
}

async function apiSaveResource(r: Resource): Promise<boolean> {
  try {
    const res = await fetch("/api/rooster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "resource", id: r.id, name: r.name, role: r.role, color: r.color }),
    })
    const json = await res.json()
    return json.success === true
  } catch { return false }
}

async function apiDeleteResource(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/rooster?type=resource&id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const json = await res.json()
    return json.success === true
  } catch { return false }
}

async function apiSaveShift(s: Shift): Promise<boolean> {
  try {
    const res = await fetch("/api/rooster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "shift",
        id: s.id,
        resource_id: s.resourceId,
        title: s.title,
        shift_date: s.date,
        start_hour: s.startHour,
        end_hour: s.endHour,
        color: s.color,
      }),
    })
    const json = await res.json()
    return json.success === true
  } catch { return false }
}

async function apiDeleteShift(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/rooster?type=shift&id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const json = await res.json()
    return json.success === true
  } catch { return false }
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const SEED_RESOURCES: Resource[] = [
  { id: "r1", name: "Ahmad Faris",    role: "Driver",    color: RESOURCE_COLORS[0] },
  { id: "r2", name: "Siti Aminah",    role: "Operator",  color: RESOURCE_COLORS[1] },
  { id: "r3", name: "Mohd Hazwan",    role: "Driver",    color: RESOURCE_COLORS[2] },
  { id: "r4", name: "Nurul Izzati",   role: "Supervisor",color: RESOURCE_COLORS[3] },
  { id: "r5", name: "Khairul Azman",  role: "Operator",  color: RESOURCE_COLORS[4] },
]

function makeSeedShifts(resources: Resource[]): Shift[] {
  const today = new Date()
  const week = getWeekDates(today)
  const shifts: Shift[] = []
  let sid = 1
  const shiftTemplates = [
    { title: "Morning",   startHour: 7,  endHour: 15, color: "#3B82F6" },
    { title: "Afternoon", startHour: 12, endHour: 20, color: "#F97316" },
    { title: "Night",     startHour: 20, endHour: 24, color: "#A855F7" },
    { title: "Morning",   startHour: 6,  endHour: 14, color: "#22C55E" },
  ]
  resources.forEach((res, ri) => {
    ;[1, 2, 3, 4, 5].forEach((dayOffset) => {
      const date = toDateKey(week[dayOffset])
      const tmpl = shiftTemplates[ri % shiftTemplates.length]
      shifts.push({
        id: `seed_s${sid++}`,
        resourceId: res.id,
        title: tmpl.title,
        date,
        startHour: tmpl.startHour,
        endHour: tmpl.endHour,
        color: tmpl.color,
      })
    })
  })
  return shifts
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

type ViewMode = "week" | "day"

export function Rooster() {
  const today = new Date()
  const { isEditMode } = useEditMode()

  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [resources, setResources] = useState<Resource[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [shiftDialog, setShiftDialog] = useState<{
    open: boolean
    mode: "add" | "edit"
    shift?: Shift
    resourceId?: string
    date?: string
  }>({ open: false, mode: "add" })

  const [resourceDialog, setResourceDialog] = useState<{
    open: boolean
    mode: "add" | "edit"
    resource?: Resource
  }>({ open: false, mode: "add" })

  // ── Load from DB on mount ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { resources: dbRes, shifts: dbShifts } = await apiFetchAll()
    if (dbRes.length === 0) {
      // Seed default data on first launch
      for (const r of SEED_RESOURCES) await apiSaveResource(r)
      const seedShifts = makeSeedShifts(SEED_RESOURCES)
      for (const s of seedShifts) await apiSaveShift(s)
      setResources(SEED_RESOURCES)
      setShifts(seedShifts)
    } else {
      setResources(dbRes)
      setShifts(dbShifts)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Shift form state
  const [shiftForm, setShiftForm] = useState({
    title: "Morning",
    resourceId: resources[0]?.id ?? "",
    date: toDateKey(today),
    startHour: 8,
    endHour: 16,
    color: "#3B82F6",
  })

  // Resource form state
  const [resForm, setResForm] = useState({
    name: "",
    role: "",
    color: RESOURCE_COLORS[0],
  })

  // Derived week dates
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])

  const headerLabel = useMemo(() => {
    if (viewMode === "day") {
      const d = currentDate
      return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    }
    const start = weekDates[0]
    const end = weekDates[6]
    const sameMo = start.getMonth() === end.getMonth()
    if (sameMo) {
      return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`
    }
    return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
  }, [viewMode, currentDate, weekDates])

  // Navigation
  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate)
    if (viewMode === "day") d.setDate(d.getDate() + dir)
    else d.setDate(d.getDate() + dir * 7)
    setCurrentDate(d)
  }

  const goToday = () => setCurrentDate(new Date())

  // Column dates for current view
  const colDates: Date[] = viewMode === "week"
    ? weekDates
    : [currentDate]

  // ── Shift CRUD ────────────────────────────────────────────────────────────

  const openAddShift = (resourceId?: string, date?: string) => {
    setShiftForm({
      title: "Morning",
      resourceId: resourceId ?? resources[0]?.id ?? "",
      date: date ?? toDateKey(currentDate),
      startHour: 8,
      endHour: 16,
      color: "#3B82F6",
    })
    setShiftDialog({ open: true, mode: "add", resourceId, date })
  }

  const openEditShift = (shift: Shift) => {
    setShiftForm({
      title: shift.title,
      resourceId: shift.resourceId,
      date: shift.date,
      startHour: shift.startHour,
      endHour: shift.endHour,
      color: shift.color,
    })
    setShiftDialog({ open: true, mode: "edit", shift })
  }

  const saveShift = async () => {
    if (!shiftForm.title.trim()) { toast.error("Please enter a shift title"); return }
    if (shiftForm.endHour <= shiftForm.startHour) { toast.error("End time must be after start time"); return }

    if (shiftDialog.mode === "add") {
      const newShift: Shift = {
        id: `s${Date.now()}`,
        ...shiftForm,
        title: shiftForm.title.trim(),
      }
      const ok = await apiSaveShift(newShift)
      if (ok) { setShifts(prev => [...prev, newShift]); toast.success("Shift added") }
      else toast.error("Failed to save shift")
    } else {
      const updated: Shift = { ...shiftDialog.shift!, ...shiftForm, title: shiftForm.title.trim() }
      const ok = await apiSaveShift(updated)
      if (ok) {
        setShifts(prev => prev.map(s => s.id === updated.id ? updated : s))
        toast.success("Shift updated")
      } else toast.error("Failed to update shift")
    }
    setShiftDialog({ open: false, mode: "add" })
  }

  const deleteShift = async (id: string) => {
    const ok = await apiDeleteShift(id)
    if (ok) { setShifts(prev => prev.filter(s => s.id !== id)); toast.success("Shift removed") }
    else toast.error("Failed to delete shift")
  }

  // ── Resource CRUD ─────────────────────────────────────────────────────────

  const openAddResource = () => {
    setResForm({ name: "", role: "", color: RESOURCE_COLORS[resources.length % RESOURCE_COLORS.length] })
    setResourceDialog({ open: true, mode: "add" })
  }

  const openEditResource = (r: Resource) => {
    setResForm({ name: r.name, role: r.role, color: r.color })
    setResourceDialog({ open: true, mode: "edit", resource: r })
  }

  const saveResource = async () => {
    if (!resForm.name.trim()) { toast.error("Please enter a name"); return }
    if (resourceDialog.mode === "add") {
      const nr: Resource = { id: `r${Date.now()}`, name: resForm.name.trim(), role: resForm.role.trim(), color: resForm.color }
      const ok = await apiSaveResource(nr)
      if (ok) { setResources(prev => [...prev, nr]); toast.success("Staff added") }
      else toast.error("Failed to save staff")
    } else {
      const updated: Resource = { ...resourceDialog.resource!, ...resForm, name: resForm.name.trim(), role: resForm.role.trim() }
      const ok = await apiSaveResource(updated)
      if (ok) {
        setResources(prev => prev.map(r => r.id === updated.id ? updated : r))
        toast.success("Staff updated")
      } else toast.error("Failed to update staff")
    }
    setResourceDialog({ open: false, mode: "add" })
  }

  const deleteResource = async (id: string) => {
    const ok = await apiDeleteResource(id)
    if (ok) {
      setResources(prev => prev.filter(r => r.id !== id))
      setShifts(prev => prev.filter(s => s.resourceId !== id))
      toast.success("Staff removed")
    } else toast.error("Failed to delete staff")
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Loading roster…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-border/60 shrink-0 bg-background/80 backdrop-blur-sm">
        {/* Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={goToday}
            className="h-9 px-4 text-xs font-semibold rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigate(1)}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Label */}
        <h2 className="text-base font-bold flex-1 text-center sm:text-left">
          {headerLabel}
        </h2>

        {/* View toggles */}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 overflow-hidden bg-muted/30 p-1">
          {(["week", "day"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`h-8 px-4 text-xs font-semibold rounded-md capitalize transition-all ${
                viewMode === v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "week" ? <><CalendarDays className="size-3 inline mr-1" />Week</> : <><Clock className="size-3 inline mr-1" />Day</>}
            </button>
          ))}
        </div>

        {/* Add shift — edit mode only */}
        {isEditMode && (
        <button
          onClick={() => openAddShift()}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="size-4" />
          Add Shift
        </button>
        )}

        {/* Add resource — edit mode only */}
        {isEditMode && (
        <button
          onClick={openAddResource}
          className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 text-xs font-semibold transition-colors"
        >
          <Users className="size-4" />
          Add Staff
        </button>
        )}
      </div>

      {/* ── Timeline grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto bg-background">
        {resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Users className="size-10 opacity-30" />
            <div className="text-sm">No staff added yet</div>
            {isEditMode && (
              <button
                onClick={openAddResource}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="size-3.5" />
                Add Staff
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `160px repeat(${colDates.length}, minmax(140px, 1fr))`,
            }}
          >
            {/* ── Frozen header: Staff column ─────────────────────────────── */}
            <div
              className="sticky top-0 left-0 z-30 bg-background border-b border-r border-border/70 px-5 py-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)]"
            >
              <Users className="size-4 shrink-0" />
              Staff
            </div>

            {/* ── Day column headers ───────────────────────────────────────── */}
            {colDates.map(date => {
              const isToday = isSameDay(date, today)
              return (
                <div
                  key={toDateKey(date)}
                  className={`sticky top-0 z-20 bg-background border-b border-border/70 text-center py-4 px-3 transition-colors ${
                    isToday ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-primary" : ""}`}>
                    {DAYS_SHORT[date.getDay()]}
                  </div>
                  <div className={`mt-1 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                    isToday ? "bg-primary text-primary-foreground" : ""
                  }`}>
                    {date.getDate()}
                  </div>
                </div>
              )
            })}

            {/* ── Resource rows ────────────────────────────────────────────── */}
            {resources.map((resource, ri) => {
              const rowShifts = shifts.filter(s => s.resourceId === resource.id)
              const rowBg = ri % 2 !== 0 ? "bg-muted/[0.04]" : "bg-background"
              return (
                <div key={resource.id} style={{ display: "contents" }}>

                  {/* Frozen name cell */}
                  <div
                    className={`sticky left-0 z-10 bg-background border-b border-r border-border/70 px-4 py-4 flex flex-col justify-center gap-1.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.10)]`}
                    style={{ minHeight: "96px" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: resource.color }}
                      />
                      <span className="text-sm font-semibold text-foreground leading-tight">
                        {resource.name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-[20px] leading-tight">
                      {resource.role}
                    </div>
                    {isEditMode && (
                      <div className="flex items-center gap-1.5 mt-2 ml-[20px]">
                        <button
                          onClick={e => { e.stopPropagation(); openEditResource(resource) }}
                          className="h-6 w-6 flex items-center justify-center rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40"
                          title="Edit staff"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteResource(resource.id) }}
                          className="h-6 w-6 flex items-center justify-center rounded bg-muted/60 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors border border-border/40"
                          title="Delete staff"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Day cells */}
                  {colDates.map(date => {
                    const dateKey = toDateKey(date)
                    const dayShifts = rowShifts.filter(s => s.date === dateKey)
                    const isToday = isSameDay(date, today)
                    return (
                      <div
                        key={dateKey}
                        className={`${rowBg} border-b border-r border-border/40 relative px-3 py-3 flex flex-col gap-2 transition-colors ${
                          isEditMode ? "cursor-pointer hover:bg-muted/20" : ""
                        } ${isToday ? "bg-primary/[0.03]" : ""}`}
                        style={{ minHeight: "96px" }}
                        onClick={() => { if (isEditMode) openAddShift(resource.id, dateKey) }}
                      >
                        {dayShifts.map(shift => (
                          <ShiftBlock
                            key={shift.id}
                            shift={shift}
                            isEditMode={isEditMode}
                            onEdit={() => { if (isEditMode) openEditShift(shift) }}
                          />
                        ))}
                        {dayShifts.length === 0 && isEditMode && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Plus className="size-3.5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Shift Dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={shiftDialog.open} onOpenChange={o => !o && setShiftDialog(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              {shiftDialog.mode === "add" ? "Add Shift" : "Edit Shift"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">
            {/* Title */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shift Name</label>
              <Input
                placeholder="e.g. Morning, Afternoon, Night"
                value={shiftForm.title}
                onChange={e => setShiftForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            {/* Resource */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Staff</label>
              <select
                value={shiftForm.resourceId}
                onChange={e => setShiftForm(p => ({ ...p, resourceId: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {resources.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {/* Date */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
              <Input
                type="date"
                value={shiftForm.date}
                onChange={e => setShiftForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            {/* Start / End */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start</label>
                <select
                  value={shiftForm.startHour}
                  onChange={e => setShiftForm(p => ({ ...p, startHour: Number(e.target.value) }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {HOUR_LABELS.map((lbl, i) => (
                    <option key={i} value={i}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End</label>
                <select
                  value={shiftForm.endHour}
                  onChange={e => setShiftForm(p => ({ ...p, endHour: Number(e.target.value) }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {HOUR_LABELS.map((lbl, i) => (
                    <option key={i + 1} value={i + 1}>{lbl}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Color */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</label>
              <div className="flex flex-wrap gap-2">
                {SHIFT_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setShiftForm(p => ({ ...p, color: c.value }))}
                    title={c.label}
                    className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 transition-all ${
                      shiftForm.color === c.value ? "ring-foreground scale-110" : "ring-transparent hover:ring-border"
                    }`}
                    style={{ backgroundColor: c.value }}
                  >
                    {shiftForm.color === c.value && (
                      <svg className="size-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="3,8 7,12 13,4" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {shiftDialog.mode === "edit" && shiftDialog.shift && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await deleteShift(shiftDialog.shift!.id)
                    setShiftDialog({ open: false, mode: "add" })
                  }}
                  className="gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Delete Shift
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShiftDialog(p => ({ ...p, open: false }))}>Cancel</Button>
              <Button size="sm" onClick={saveShift}>
                {shiftDialog.mode === "add" ? "Add Shift" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Resource Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={resourceDialog.open} onOpenChange={o => !o && setResourceDialog(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {resourceDialog.mode === "add" ? "Add Staff" : "Edit Staff"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</label>
              <Input
                placeholder="e.g. Ahmad Faris"
                value={resForm.name}
                onChange={e => setResForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</label>
              <Input
                placeholder="e.g. Driver, Operator"
                value={resForm.role}
                onChange={e => setResForm(p => ({ ...p, role: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</label>
              <div className="flex flex-wrap gap-2">
                {RESOURCE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setResForm(p => ({ ...p, color: c }))}
                    className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 transition-all ${
                      resForm.color === c ? "ring-foreground scale-110" : "ring-transparent hover:ring-border"
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {resForm.color === c && (
                      <svg className="size-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="3,8 7,12 13,4" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {resourceDialog.mode === "edit" && resourceDialog.resource && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await deleteResource(resourceDialog.resource!.id)
                    setResourceDialog({ open: false, mode: "add" })
                  }}
                  className="gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Delete Staff
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setResourceDialog(p => ({ ...p, open: false }))}>Cancel</Button>
              <Button size="sm" onClick={saveResource}>
                {resourceDialog.mode === "add" ? "Add" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── SHIFT BLOCK ──────────────────────────────────────────────────────────────

function ShiftBlock({
  shift,
  isEditMode,
  onEdit,
}: {
  shift: Shift
  isEditMode: boolean
  onEdit: () => void
}) {
  const startLabel = formatHour(shift.startHour)
  const endLabel = formatHour(shift.endHour)
  const duration = shift.endHour - shift.startHour

  return (
    <div
      className={`pl-3 py-1.5 rounded-md select-none transition-all ${isEditMode ? "cursor-pointer hover:opacity-70 active:scale-[0.98]" : "cursor-default"}`}
      style={{ borderLeft: `3px solid ${shift.color}`, backgroundColor: `${shift.color}08` }}
      onClick={e => { e.stopPropagation(); if (isEditMode) onEdit() }}
      title={`${shift.title}: ${startLabel} – ${endLabel} (${duration}h)`}
    >
      <div className="text-xs font-semibold leading-tight truncate text-foreground">{shift.title}</div>
      <div className="text-[11px] leading-tight text-muted-foreground mt-1 truncate">{startLabel} – {endLabel}</div>
    </div>
  )
}

export default Rooster
