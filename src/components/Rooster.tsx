import { useState, useMemo, useEffect, useCallback } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock,
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

export function Rooster({ viewMode: viewModeProp = "week" }: { viewMode?: ViewMode }) {
  const today = new Date()
  const { isEditMode } = useEditMode()

  const [viewMode, setViewMode] = useState<ViewMode>(viewModeProp)

  useEffect(() => { setViewMode(viewModeProp) }, [viewModeProp])
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
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => navigate(-1)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3.5" />
          </button>
          <button onClick={goToday} className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-border bg-card hover:bg-muted transition-colors">
            Today
          </button>
          <button onClick={() => navigate(1)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <h2 className="text-sm font-bold flex-1 truncate">{headerLabel}</h2>

        {isEditMode && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={openAddResource}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-semibold transition-colors"
            >
              <Users className="size-3" />Staff
            </button>
            <button
              onClick={() => openAddShift()}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="size-3" />Shift
            </button>
          </div>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full text-muted-foreground py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <Users className="size-7 opacity-30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">No staff yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add staff to start building the roster</p>
            </div>
            {isEditMode && (
              <button
                onClick={openAddResource}
                className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="size-3.5" />Add Staff
              </button>
            )}
          </div>
        ) : (
          <table className="border-collapse" style={{ width: "max-content", minWidth: "100%", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "164px" }} />
              {colDates.map(d => <col key={toDateKey(d)} style={{ width: "140px" }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-card border-b border-r border-border px-3 py-3 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Users className="size-3" />Staff
                  </span>
                </th>
                {colDates.map(date => {
                  const isToday = isSameDay(date, today)
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6
                  return (
                    <th
                      key={toDateKey(date)}
                      className={`sticky top-0 z-20 border-b border-r border-border text-center py-2.5 px-2 font-normal ${
                        isToday ? "bg-primary/[0.06]" : isWeekend ? "bg-muted/20" : "bg-card"
                      }`}
                    >
                      <div className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${
                        isToday ? "text-primary" : isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"
                      }`}>
                        {DAYS_SHORT[date.getDay()]}
                      </div>
                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        isToday
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : isWeekend
                          ? "text-muted-foreground/50"
                          : "text-foreground/80"
                      }`}>
                        {date.getDate()}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {resources.map((resource, ri) => {
                const rowShifts = shifts.filter(s => s.resourceId === resource.id)
                const viewShiftCount = colDates.reduce((acc, d) =>
                  acc + rowShifts.filter(s => s.date === toDateKey(d)).length, 0)
                return (
                  <tr key={resource.id} className={ri % 2 !== 0 ? "bg-muted/[0.03]" : ""}>

                    {/* ── Staff cell ── */}
                    <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-3 align-top">
                      <div className="flex items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-foreground leading-tight truncate">{resource.name}</p>
                          {resource.role && (
                            <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate">{resource.role}</p>
                          )}
                          <span
                            className="inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                            style={{ backgroundColor: `${resource.color}18`, color: resource.color }}
                          >
                            {viewShiftCount} shift{viewShiftCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      {isEditMode && (
                        <div className="flex items-center gap-0.5 mt-2">
                          <button
                            onClick={e => { e.stopPropagation(); openEditResource(resource) }}
                            className="h-5 px-1.5 flex items-center gap-1 rounded text-[9px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="size-2.5" />Edit
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); deleteResource(resource.id) }}
                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                          >
                            <Trash2 className="size-2.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* ── Day cells ── */}
                    {colDates.map(date => {
                      const dateKey = toDateKey(date)
                      const dayShifts = rowShifts.filter(s => s.date === dateKey)
                      const isToday = isSameDay(date, today)
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6
                      return (
                        <td
                          key={dateKey}
                          className={`border-b border-r border-border align-top p-1.5 transition-colors ${
                            isToday ? "bg-primary/[0.02]" : isWeekend ? "bg-muted/10" : ""
                          } ${isEditMode ? "cursor-pointer hover:bg-muted/25" : ""}`}
                          style={{ minHeight: "72px" }}
                          onClick={() => { if (isEditMode) openAddShift(resource.id, dateKey) }}
                        >
                          <div className="flex flex-col gap-1">
                            {dayShifts.map(shift => (
                              <ShiftBlock
                                key={shift.id}
                                shift={shift}
                                isEditMode={isEditMode}
                                onEdit={() => openEditShift(shift)}
                              />
                            ))}
                            {isEditMode && dayShifts.length === 0 && (
                              <div className="h-8 flex items-center justify-center rounded-lg border border-dashed border-border/40 opacity-0 hover:opacity-100 transition-opacity">
                                <Plus className="size-3 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Shift Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={shiftDialog.open} onOpenChange={o => !o && setShiftDialog(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              {shiftDialog.mode === "add" ? "Add Shift" : "Edit Shift"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shift Name</label>
              <Input placeholder="e.g. Morning, Afternoon, Night" value={shiftForm.title} onChange={e => setShiftForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Staff</label>
              <select value={shiftForm.resourceId} onChange={e => setShiftForm(p => ({ ...p, resourceId: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
              <Input type="date" value={shiftForm.date} onChange={e => setShiftForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start</label>
                <select value={shiftForm.startHour} onChange={e => setShiftForm(p => ({ ...p, startHour: Number(e.target.value) }))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {HOUR_LABELS.map((lbl, i) => <option key={i} value={i}>{lbl}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End</label>
                <select value={shiftForm.endHour} onChange={e => setShiftForm(p => ({ ...p, endHour: Number(e.target.value) }))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {HOUR_LABELS.map((lbl, i) => <option key={i + 1} value={i + 1}>{lbl}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</label>
              <div className="flex flex-wrap gap-2">
                {SHIFT_COLORS.map(c => (
                  <button key={c.value} onClick={() => setShiftForm(p => ({ ...p, color: c.value }))} title={c.label}
                    className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 transition-all ${shiftForm.color === c.value ? "ring-foreground scale-110" : "ring-transparent hover:ring-border"}`}
                    style={{ backgroundColor: c.value }}>
                    {shiftForm.color === c.value && <svg className="size-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3,8 7,12 13,4" /></svg>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {shiftDialog.mode === "edit" && shiftDialog.shift && (
                <Button variant="destructive" size="sm" onClick={async () => { await deleteShift(shiftDialog.shift!.id); setShiftDialog({ open: false, mode: "add" }) }} className="gap-1.5">
                  <Trash2 className="size-3.5" />Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShiftDialog(p => ({ ...p, open: false }))}>Cancel</Button>
              <Button size="sm" onClick={saveShift}>{shiftDialog.mode === "add" ? "Add Shift" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Resource Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={resourceDialog.open} onOpenChange={o => !o && setResourceDialog(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {resourceDialog.mode === "add" ? "Add Staff" : "Edit Staff"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</label>
              <Input placeholder="e.g. Ahmad Faris" value={resForm.name} onChange={e => setResForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</label>
              <Input placeholder="e.g. Driver, Operator" value={resForm.role} onChange={e => setResForm(p => ({ ...p, role: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</label>
              <div className="flex flex-wrap gap-2">
                {RESOURCE_COLORS.map(c => (
                  <button key={c} onClick={() => setResForm(p => ({ ...p, color: c }))}
                    className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 transition-all ${resForm.color === c ? "ring-foreground scale-110" : "ring-transparent hover:ring-border"}`}
                    style={{ backgroundColor: c }}>
                    {resForm.color === c && <svg className="size-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3,8 7,12 13,4" /></svg>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {resourceDialog.mode === "edit" && resourceDialog.resource && (
                <Button variant="destructive" size="sm" onClick={async () => { await deleteResource(resourceDialog.resource!.id); setResourceDialog({ open: false, mode: "add" }) }} className="gap-1.5">
                  <Trash2 className="size-3.5" />Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setResourceDialog(p => ({ ...p, open: false }))}>Cancel</Button>
              <Button size="sm" onClick={saveResource}>{resourceDialog.mode === "add" ? "Add" : "Save"}</Button>
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
      className={`rounded-md overflow-hidden select-none transition-all ${
        isEditMode ? "cursor-pointer hover:brightness-95 active:scale-[0.98]" : "cursor-default"
      }`}
      style={{ backgroundColor: `${shift.color}12`, border: `1px solid ${shift.color}30` }}
      onClick={e => { e.stopPropagation(); if (isEditMode) onEdit() }}
      title={`${shift.title}: ${startLabel} – ${endLabel} (${duration}h)`}
    >
      <div className="h-[3px] w-full" style={{ backgroundColor: shift.color }} />
      <div className="px-2 py-1.5">
        <div className="text-[10px] font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: shift.color }}>
          {shift.title}
        </div>
        {isEditMode && (
          <div className="text-[9px] leading-tight text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
            {startLabel} – {endLabel} · {duration}h
          </div>
        )}
      </div>
    </div>
  )
}

export default Rooster
