import { useState, useMemo, useEffect } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Loader2, CalendarCheck, CalendarPlus, CalendarX, WifiOff, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useEditMode } from "@/contexts/EditModeContext"

// ─── TYPES ───────────────────────────────────────────────────────────────────

type EventType = "meeting" | "deadline" | "event" | "reminder"

interface Event {
  id: number
  title: string
  date: Date
  color: string
  type: EventType
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const HOURS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12 AM"
  if (i < 12) return `${i} AM`
  if (i === 12) return "12 PM"
  return `${i - 12} PM`
})

const TYPE_COLORS: Record<EventType, string> = {
  meeting:  "bg-blue-500",
  deadline: "bg-red-500",
  event:    "bg-purple-500",
  reminder: "bg-green-500",
}

const TYPE_LABELS: Record<EventType, string> = {
  meeting:  "Meeting",
  deadline: "Deadline",
  event:    "Event",
  reminder: "Reminder",
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseDateInput(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
}

function getEventsForDate(events: Event[], date: Date) {
  return events.filter(e => isSameDay(e.date, date))
}

// ─── LEGEND ──────────────────────────────────────────────────────────────────

function Legend() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Event Types</span>
        <ChevronDown className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex items-center gap-4">
          {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2.5 h-2.5 ${TYPE_COLORS[type]} rounded`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── EVENT FORM DIALOG ───────────────────────────────────────────────────────

interface EventFormDialogProps {
  open: boolean
  onClose: () => void
  initialDate?: Date | null
  event?: Event | null
  onSave: (data: { id?: number; title: string; date: Date; type: EventType }) => void | Promise<void>
  onDelete?: (id: number) => void | Promise<void>
}

function EventFormDialog({ open, onClose, initialDate, event, onSave, onDelete }: EventFormDialogProps) {
  const isEdit = !!event
  const [title, setTitle] = useState("")
  const [dateVal, setDateVal] = useState("")
  const [type, setType] = useState<EventType>("meeting")

  useEffect(() => {
    if (!open) return
    if (event) {
      setTitle(event.title)
      setDateVal(toDateInputValue(event.date))
      setType(event.type)
    } else {
      setTitle("")
      setDateVal(initialDate ? toDateInputValue(initialDate) : toDateInputValue(new Date()))
      setType("meeting")
    }
  }, [open, event, initialDate])

  function handleSave() {
    if (!title.trim() || !dateVal) return
    const eventData = {
      ...(isEdit ? { id: event!.id } : {}),
      title: title.trim(),
      date: parseDateInput(dateVal),
      type,
    }
    onSave(eventData)
    onClose()
  }

  function handleDelete() {
    if (event && onDelete) {
      onDelete(event.id)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm rounded-2xl" overlayClassName="backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Event title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave() }}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all
                    ${type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${TYPE_COLORS[t]} shrink-0`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {isEdit && onDelete ? (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={handleDelete}>
                <Trash2 className="size-3.5" />Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={!title.trim() || !dateVal}>
                {isEdit ? "Save Changes" : "Add Event"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── MONTH VIEW ──────────────────────────────────────────────────────────────

interface ViewProps {
  events: Event[]
  isEditMode: boolean
  onAdd: (date: Date) => void
  onEdit: (event: Event) => void
}

function MonthView({ events, isEditMode, onAdd, onEdit }: ViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [eventsOpen, setEventsOpen] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = useMemo(() => new Date(year, month, 1).getDay(), [year, month])
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month])

  const calendarDays = useMemo(() => {
    const days: Array<{ day: number | null; date: Date | null }> = []
    for (let i = 0; i < firstDayOfMonth; i++) days.push({ day: null, date: null })
    for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, date: new Date(year, month, i) })
    return days
  }, [firstDayOfMonth, daysInMonth, year, month])

  const isToday = (date: Date) => isSameDay(date, new Date())
  const isSelected = (date: Date) => selectedDate ? isSameDay(date, selectedDate) : false

  const selectedDateEvents = useMemo(() =>
    selectedDate ? getEventsForDate(events, selectedDate) : [],
    [selectedDate, events])

  return (
    <div className="flex flex-col gap-3 p-3 lg:p-5" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <div className="bg-card border border-border rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-base font-semibold">{MONTHS[month]} {year}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8"
              onClick={() => { const t = new Date(); setCurrentDate(t); setSelectedDate(t) }}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setCurrentDate(new Date(year, month - 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setCurrentDate(new Date(year, month + 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 bg-muted/20 border-b border-border">
          {DAYS.map(day => (
            <div key={day} className="text-center text-[10px] font-semibold text-muted-foreground py-2 border-r border-border last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            if (!day.date || !day.day) {
              return <div key={index} className="relative min-h-[100px] p-1.5 border-b border-r border-border last:border-r-0 bg-muted/10" />
            }
            const dayEvents = getEventsForDate(events, day.date)
            const todayDate = isToday(day.date)
            const selectedDate_ = isSelected(day.date)
            return (
              <div key={index}
                className={`relative min-h-[100px] p-1.5 border-b border-r border-border last:border-r-0 transition-colors bg-background
                  ${todayDate ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}
                  ${selectedDate_ ? "bg-primary/5 ring-2 ring-inset ring-primary/30" : ""}`}>
                <button
                  onClick={() => setSelectedDate(day.date)}
                  className="absolute inset-0 w-full h-full"
                  aria-label={`Select ${day.date.toLocaleDateString()}`}
                />
                <div className="relative flex items-center justify-between mb-1 z-10">
                  {isEditMode ? (
                    <button
                      className="p-0.5 rounded-full hover:bg-primary/10 transition-opacity"
                      onClick={e => { e.stopPropagation(); onAdd(day.date!) }}
                      aria-label="Add event"
                      title="Add event"
                    >
                      <Plus className="size-3 text-muted-foreground" />
                    </button>
                  ) : <div className="w-5" />}
                  <span className={`text-xs font-medium ml-auto
                    ${todayDate ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold" : ""}`}>
                    {day.day}
                  </span>
                </div>
                <div className="relative space-y-1 mt-1 z-10">
                  {dayEvents.slice(0, 3).map(event => (
                    <button key={event.id}
                      onClick={e => { e.stopPropagation(); if (isEditMode) onEdit(event) }}
                      className={`w-full text-left text-[10px] leading-tight ${event.color} text-white px-1.5 py-0.5 rounded truncate font-medium hover:opacity-90 transition-opacity ${!isEditMode ? "cursor-default" : ""}`}
                      title={event.title}>
                      {event.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground font-medium pl-1">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow overflow-hidden">
        <button
          className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setEventsOpen(v => !v)}
        >
          <div className="flex items-center gap-3">
            <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ${eventsOpen ? "rotate-180" : ""}`} />
            <h3 className="text-base font-semibold">
              {selectedDate
                ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                : "Select a date"}
            </h3>
            {selectedDate && isEditMode && eventsOpen && (
              <Button size="sm" variant="outline" className="h-8" onClick={e => { e.stopPropagation(); onAdd(selectedDate) }}>
                <Plus className="size-3 mr-1" />Add Event
              </Button>
            )}
          </div>
          <div onClick={e => e.stopPropagation()}>
            <Legend />
          </div>
        </button>
        {eventsOpen && selectedDate && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedDateEvents.length > 0 ? selectedDateEvents.map(event => (
                <button key={event.id}
                  onClick={() => { if (isEditMode) onEdit(event) }}
                  className={`group p-4 border border-border rounded-lg transition-all text-left bg-background ${isEditMode ? "hover:border-primary/50 hover:shadow-md cursor-pointer" : "cursor-default"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-1 self-stretch ${event.color} rounded-full flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">{event.title}</h4>
                      <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                        <span className={`w-2 h-2 ${event.color} rounded-full`} />{event.type}
                      </p>
                    </div>
                      {isEditMode && <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />}
                  </div>
                </button>
              )) : (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <p className="text-sm mb-3">No events scheduled for this date</p>
                  {isEditMode && (
                    <Button size="sm" variant="outline" onClick={() => onAdd(selectedDate)}>
                      <Plus className="size-3 mr-1" />Add Event
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {eventsOpen && !selectedDate && (
          <div className="text-center py-16 text-muted-foreground"><p className="text-sm">Click on a date to view events</p></div>
        )}
      </div>
    </div>
  )
}

// ─── WEEK VIEW ───────────────────────────────────────────────────────────────

function WeekView({ events, isEditMode, onAdd, onEdit }: ViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const weekStart = useMemo(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  }, [currentDate])

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    }), [weekStart])

  const goToPrevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }
  const goToNextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }

  const weekLabel = useMemo(() => {
    const end = weekDays[6]
    const s = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return `${s} – ${e}`
  }, [weekStart, weekDays])

  const today = new Date()
  const currentHour = today.getHours()

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 lg:p-6 gap-4">
      <div className="bg-card border border-border rounded-lg shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <h2 className="text-xl font-semibold">{weekLabel}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevWeek}><ChevronLeft className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextWeek}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="min-w-[640px]">
            <div className="grid border-b border-border bg-background sticky top-0 z-10" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
              <div className="border-r border-border" />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today)
                return (
                  <div key={i} className={`text-center py-2 border-r border-border last:border-r-0 ${isToday ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}>
                    <div className="text-xs font-semibold text-muted-foreground">{DAYS[day.getDay()]}</div>
                    <div className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full
                      ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                      {day.getDate()}
                    </div>
                    {isEditMode && (
                      <button
                        onClick={() => onAdd(day)}
                        className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors mx-auto px-1.5 py-0.5 rounded hover:bg-primary/10"
                        title="Add event">
                        <Plus className="size-2.5" />Add
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="grid border-b border-border" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
              <div className="border-r border-border flex items-center justify-center py-1">
                <span className="text-[10px] text-muted-foreground select-none">All day</span>
              </div>
              {weekDays.map((day, i) => {
                const dayEvents = getEventsForDate(events, day)
                const isToday = isSameDay(day, today)
                return (
                  <div key={i} className={`min-h-[36px] p-1 border-r border-border last:border-r-0 space-y-0.5 ${isToday ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}>
                    {dayEvents.map(event => (
                      <button key={event.id}
                        onClick={() => { if (isEditMode) onEdit(event) }}
                        className={`w-full text-left text-[10px] leading-tight ${event.color} text-white px-1.5 py-0.5 rounded truncate font-medium hover:opacity-90 transition-opacity ${!isEditMode ? "cursor-default" : ""}`}
                        title={event.title}>
                        {event.title}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
            {HOURS.map((label, hour) => (
              <div key={hour} className="grid border-b border-border last:border-b-0" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
                <div className="border-r border-border text-[10px] text-muted-foreground text-right pr-2 pt-1.5 select-none leading-none">{label}</div>
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, today)
                  const isCurrentHour = isToday && currentHour === hour
                  return (
                    <div key={i}
                      className={`h-14 border-r border-border last:border-r-0 relative transition-colors
                        ${isEditMode ? "cursor-pointer hover:bg-accent/30" : ""}
                        ${isToday ? "bg-blue-50/20 dark:bg-blue-950/10" : ""}
                        ${isCurrentHour ? "bg-blue-100/40 dark:bg-blue-900/20" : ""}`}
                      onClick={() => { if (isEditMode) onAdd(day) }}
                      title={isEditMode ? "Add event" : ""}>
                      {isCurrentHour && (
                        <div className="absolute left-0 right-0 top-0 flex items-center pointer-events-none">
                          <div className="w-2 h-2 rounded-full bg-primary -ml-1 shrink-0 z-10" />
                          <div className="flex-1 border-t-2 border-primary" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg px-6 py-3 flex items-center shrink-0">
        <Legend />
      </div>
    </div>
  )
}

// ─── DAY VIEW ────────────────────────────────────────────────────────────────

function DayView({ events, isEditMode, onAdd, onEdit }: ViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const goToPrev = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d) }
  const goToNext = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d) }

  const dayLabel = currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  const isToday = isSameDay(currentDate, new Date())
  const dayEvents = useMemo(() => getEventsForDate(events, currentDate), [currentDate, events])
  const currentHour = new Date().getHours()

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 lg:p-6 gap-4">
      <div className="bg-card border border-border rounded-lg shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {dayLabel}
            {isToday && <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Today</span>}
          </h2>
          <div className="flex items-center gap-2">
            {isEditMode && (
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAdd(currentDate)}>
                <Plus className="size-3" />Add Event
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev}><ChevronLeft className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="min-w-[300px]">
            {dayEvents.length > 0 && (
              <div className="flex border-b border-border">
                <div className="w-16 shrink-0 border-r border-border text-[10px] text-muted-foreground text-right pr-2 flex items-center justify-end py-2 select-none">
                  All day
                </div>
                <div className="flex-1 p-2 space-y-1">
                  {dayEvents.map(event => (
                    <button key={event.id}
                      onClick={() => { if (isEditMode) onEdit(event) }}
                      className={`w-full text-left text-xs leading-tight ${event.color} text-white px-2 py-1 rounded font-medium flex items-center gap-2 hover:opacity-90 transition-opacity group ${!isEditMode ? "cursor-default" : ""}`}>
                      <span className="flex-1">{event.title}</span>
                      <span className="opacity-75 capitalize text-[10px]">· {event.type}</span>
                      {isEditMode && <Pencil className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {HOURS.map((label, hour) => {
              const isCurrentHour = isToday && currentHour === hour
              return (
                <div key={hour} className="flex border-b border-border last:border-b-0">
                  <div className={`w-16 shrink-0 border-r border-border text-[10px] text-right pr-2 pt-2 select-none leading-none
                    ${isCurrentHour ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {label}
                  </div>
                  <div className={`flex-1 h-14 relative transition-colors ${isEditMode ? "cursor-pointer hover:bg-accent/30" : ""} ${isCurrentHour ? "bg-blue-50/40 dark:bg-blue-900/20" : ""}`}
                    onClick={() => { if (isEditMode) onAdd(currentDate) }}
                    title={isEditMode ? "Add event" : ""}>
                    {isCurrentHour && (
                      <div className="absolute left-0 right-0 top-0 flex items-center pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-primary -ml-1 shrink-0 z-10" />
                        <div className="flex-1 border-t-2 border-primary" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg px-6 py-3 flex items-center shrink-0">
        <Legend />
      </div>
    </div>
  )
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────

function ListView({ events, isEditMode, onAdd, onEdit }: ViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Build a 60-day window: today → today+59
  const windowStart = useMemo(() => {
    const d = new Date(currentDate)
    d.setHours(0, 0, 0, 0)
    return d
  }, [currentDate])

  const days = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const d = new Date(windowStart)
      d.setDate(windowStart.getDate() + i)
      return d
    })
  }, [windowStart])

  // Only days that have events
  const eventDays = useMemo(() => {
    return days
      .map(day => ({ day, evts: getEventsForDate(events, day) }))
      .filter(x => x.evts.length > 0)
  }, [days, events])

  const today = new Date()
  const TYPE_BORDER: Record<EventType, string> = {
    meeting:  "border-l-blue-500",
    deadline: "border-l-red-500",
    event:    "border-l-purple-500",
    reminder: "border-l-green-500",
  }
  const TYPE_BG: Record<EventType, string> = {
    meeting:  "bg-blue-50 dark:bg-blue-950/30",
    deadline: "bg-red-50 dark:bg-red-950/30",
    event:    "bg-purple-50 dark:bg-purple-950/30",
    reminder: "bg-green-50 dark:bg-green-950/30",
  }
  const TYPE_BADGE: Record<EventType, string> = {
    meeting:  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    deadline: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    event:    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    reminder: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  }

  const windowLabel = useMemo(() => {
    const end = new Date(windowStart)
    end.setDate(windowStart.getDate() + 59)
    const s = windowStart.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })
    const e = end.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })
    return `${s} – ${e}`
  }, [windowStart])

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 lg:p-6 gap-4">
      <div className="bg-card border border-border rounded-lg shadow overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30 shrink-0">
          <h2 className="text-base font-semibold truncate">{windowLabel}</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 60); setCurrentDate(d) }}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 60); setCurrentDate(d) }}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-auto min-h-0">
          {eventDays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center">
                <ChevronRight className="size-5 opacity-40" />
              </div>
              <p className="text-sm font-medium">No events in this period</p>
              <p className="text-xs opacity-60">Try navigating to a different range</p>
              {isEditMode && (
                <Button size="sm" variant="outline" className="mt-1" onClick={() => onAdd(new Date())}>
                  <Plus className="size-3.5 mr-1" /> Add Event
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {eventDays.map(({ day, evts }) => {
                  const isToday = isSameDay(day, today)
                  return evts.map((evt, evtIdx) => (
                    <tr key={`${day.toISOString()}-${evt.id}`}
                      className={`group border-b border-border/50 last:border-b-0 transition-colors
                        ${isEditMode ? "cursor-pointer hover:bg-muted/40" : ""}
                        ${TYPE_BG[evt.type]}`}
                      onClick={() => { if (isEditMode) onEdit(evt) }}
                    >
                      {/* Date column — only show on first event of the day */}
                      <td className={`align-top w-[140px] px-4 py-3 shrink-0 border-r border-border/40 ${evtIdx > 0 ? "opacity-0 select-none" : ""}`}>
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                            {isToday ? "Today" : day.toLocaleDateString("en-MY", { weekday: "short" })}
                          </span>
                          <span className={`text-[11px] ${isToday ? "text-primary/80" : "text-muted-foreground"}`}>
                            {day.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {evtIdx === 0 && isEditMode && (
                          <button
                            onClick={e => { e.stopPropagation(); onAdd(day) }}
                            className="mt-1.5 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-primary/10"
                          >
                            <Plus className="size-2.5" /> Add
                          </button>
                        )}
                      </td>
                      {/* Color bar */}
                      <td className={`w-1 p-0 border-l-4 ${TYPE_BORDER[evt.type]}`} />
                      {/* Event title + type */}
                      <td className="px-4 py-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1 truncate">
                            {evt.title}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[evt.type]}`}>
                            {TYPE_LABELS[evt.type]}
                          </span>
                          {isEditMode && <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                        </div>
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg px-6 py-3 flex items-center shrink-0">
        <Legend />
      </div>
    </div>
  )
}

// ─── API HELPERS ─────────────────────────────────────────────────────────────

type ApiRow = { id: number; title: string; event_date: string; type: EventType }

function rowToEvent(e: ApiRow): Event {
  return {
    id: e.id,
    title: e.title,
    // event_date comes back as "YYYY-MM-DD" — parse without timezone shift
    date: new Date(e.event_date + "T00:00:00"),
    type: e.type,
    color: TYPE_COLORS[e.type] ?? "bg-blue-500",
  }
}

// ─── LOCAL STORAGE FALLBACK ──────────────────────────────────────────────────
// Used automatically when the Vercel API is unreachable (e.g. local dev with `vite dev`).

const LS_KEY = "fcalendar_events"
let _lsIdSeq = -(Date.now()) // negative IDs so they never clash with DB ids

type StoredEvent = { id: number; title: string; date: string; type: EventType; color: string }

function lsLoad(): Event[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as StoredEvent[]).map(e => ({ ...e, date: new Date(e.date) }))
  } catch { return [] }
}

function lsSaveAll(events: Event[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(
      events.map(e => ({ ...e, date: e.date.toISOString() }))
    ))
  } catch { /* quota exceeded — silently ignore */ }
}

function lsAdd(data: { title: string; date: Date; type: EventType }): Event {
  const ev: Event = { id: _lsIdSeq--, title: data.title, date: data.date, type: data.type, color: TYPE_COLORS[data.type] ?? "bg-blue-500" }
  lsSaveAll([...lsLoad(), ev])
  return ev
}

function lsUpdate(data: { id: number; title: string; date: Date; type: EventType }): Event {
  const ev: Event = { id: data.id, title: data.title, date: data.date, type: data.type, color: TYPE_COLORS[data.type] ?? "bg-blue-500" }
  lsSaveAll(lsLoad().map(e => e.id === data.id ? ev : e))
  return ev
}

function lsDelete(id: number) {
  lsSaveAll(lsLoad().filter(e => e.id !== id))
}

// ─── API + FALLBACK WRAPPERS ─────────────────────────────────────────────────

async function apiFetchEvents(): Promise<{ events: Event[]; offline: boolean }> {
  try {
    const res = await fetch("/api/calendar")
    if (!res.ok) {
      const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(json.error || `HTTP ${res.status}`)
    }
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "API error")
    return { events: (json.data as ApiRow[]).map(rowToEvent), offline: false }
  } catch (error) {
    console.log("📴 API offline, using localStorage:", error instanceof Error ? error.message : error)
    return { events: lsLoad(), offline: true }
  }
}

async function apiSaveEvent(data: { id?: number; title: string; date: Date; type: EventType }): Promise<{ event: Event; offline: boolean } | null> {
  try {
    const body: Record<string, unknown> = {
      title: data.title,
      event_date: toDateInputValue(data.date),
      type: data.type,
    }
    if (data.id !== undefined) body.id = data.id
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(json.error || `HTTP ${res.status}`)
    }
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "API error")
    return { event: rowToEvent(json.data as ApiRow), offline: false }
  } catch (apiError) {
    // fallback: save to localStorage
    console.log("⚠️ API save failed, falling back to localStorage:", apiError instanceof Error ? apiError.message : apiError)
    try {
      const ev = data.id !== undefined ? lsUpdate(data as { id: number; title: string; date: Date; type: EventType }) : lsAdd(data)
      console.log("✅ Saved to localStorage:", ev)
      return { event: ev, offline: true }
    } catch (lsError) {
      console.error("❌ Failed to save to API and localStorage:", apiError, lsError)
      return null
    }
  }
}

async function apiDeleteEvent(id: number): Promise<{ ok: boolean; offline: boolean }> {
  try {
    const res = await fetch(`/api/calendar?id=${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error("API error")
    return { ok: true, offline: false }
  } catch (error) {
    console.log("⚠️ API delete failed, falling back to localStorage:", error instanceof Error ? error.message : error)
    lsDelete(id)
    return { ok: true, offline: true }
  }
}

// ─── SEED DATA ───────────────────────────────────────────────────────────────

function getSeedEvents(): Array<{ title: string; date: Date; type: EventType }> {
  const today = new Date()
  const d = (offset: number) => {
    const x = new Date(today)
    x.setDate(today.getDate() + offset)
    return x
  }
  return [
    { title: "Team Meeting",          date: d(0),   type: "meeting"  },
    { title: "Delivery Briefing",     date: d(1),   type: "meeting"  },
    { title: "Route Submission",      date: d(2),   type: "deadline" },
    { title: "Monthly Review",        date: d(5),   type: "event"    },
    { title: "Vehicle Maintenance",   date: d(7),   type: "reminder" },
    { title: "Q2 Planning Session",   date: d(10),  type: "meeting"  },
    { title: "Inventory Deadline",    date: d(14),  type: "deadline" },
    { title: "Staff Training Day",    date: d(18),  type: "event"    },
    { title: "Safety Inspection",     date: d(-3),  type: "reminder" },
    { title: "Driver KPI Review",     date: d(-7),  type: "meeting"  },
  ]
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function Calendar({ view = "month" }: { view?: "month" | "week" | "day" | "list" }) {
  const { isEditMode } = useEditMode()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offline, setOffline] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [addDate, setAddDate] = useState<Date | null>(null)

  // Load events – seed example data if empty (API or localStorage)
  useEffect(() => {
    apiFetchEvents().then(async ({ events: data, offline: isOffline }) => {
      setOffline(isOffline)
      if (data.length === 0) {
        // Seed example events so the calendar isn't blank on first launch
        const seeds = getSeedEvents()
        const created: Event[] = []
        for (const s of seeds) {
          const result = await apiSaveEvent({ title: s.title, date: s.date, type: s.type })
          if (result) created.push(result.event)
        }
        setEvents(created)
      } else {
        setEvents(data)
      }
      setLoading(false)
    })
  }, [])

  function openAdd(date: Date) {
    setEditingEvent(null)
    setAddDate(date)
    setDialogOpen(true)
  }

  function openEdit(event: Event) {
    setEditingEvent(event)
    setAddDate(null)
    setDialogOpen(true)
  }

  // Save to API (with localStorage fallback when offline)
  async function handleSave(data: { id?: number; title: string; date: Date; type: EventType }) {
    setSaving(true)
    const dateLabel = data.date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })
    const typeLabel = TYPE_LABELS[data.type] ?? data.type
    try {
      const result = await apiSaveEvent(data)
      if (!result) {
        toast.error("Failed to save event", {
          description: `"${data.title}" could not be saved. Try again.`,
          icon: <AlertCircle className="size-4" />,
          duration: 5000,
        })
        return
      }
      const { event: saved, offline: isOffline } = result
      setOffline(isOffline)
      if (data.id !== undefined) {
        setEvents(prev => prev.map(e => e.id === data.id ? saved : e))
        toast.success("Event updated" + (isOffline ? " (offline)" : ""), {
          description: `"${data.title}" · ${typeLabel} · ${dateLabel}`,
          icon: <CalendarCheck className="size-4 text-primary" />,
          duration: 3000,
        })
      } else {
        setEvents(prev => [...prev, saved])
        toast.success("Event added" + (isOffline ? " (offline)" : ""), {
          description: `"${data.title}" · ${typeLabel} · ${dateLabel}`,
          icon: <CalendarPlus className="size-4 text-primary" />,
          duration: 3000,
        })
      }
    } catch {
      toast.error("Network error", {
        description: "Could not reach the server. Event not saved.",
        icon: <WifiOff className="size-4" />,
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    const target = events.find(e => e.id === id)
    setSaving(true)
    try {
      const { ok, offline: isOffline } = await apiDeleteEvent(id)
      setOffline(isOffline)
      if (ok) {
        setEvents(prev => prev.filter(e => e.id !== id))
        toast.success("Event removed" + (isOffline ? " (offline)" : ""), {
          description: target ? `"${target.title}" has been deleted.` : "Event has been deleted.",
          icon: <CalendarX className="size-4 text-primary" />,
          duration: 3000,
        })
      } else {
        toast.error("Failed to delete", {
          description: target ? `"${target.title}" could not be removed.` : "Event could not be removed.",
          icon: <AlertCircle className="size-4" />,
          duration: 5000,
        })
      }
    } catch {
      toast.error("Network error", {
        description: "Could not reach the server. Event not deleted.",
        icon: <WifiOff className="size-4" />,
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  const viewProps: ViewProps = { events, isEditMode, onAdd: openAdd, onEdit: openEdit }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground text-sm gap-2">
        <Loader2 className="size-4 animate-spin" /> Loading calendar…
      </div>
    )
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      {/* Offline badge */}
      {offline && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs font-medium shrink-0">
          <WifiOff className="size-3" />
          Offline mode — events saved locally on this device
        </div>
      )}

      {view === "week" && <WeekView {...viewProps} />}
      {view === "day"  && <DayView  {...viewProps} />}
      {view === "list" && <ListView {...viewProps} />}
      {view !== "week" && view !== "day" && view !== "list" && <MonthView {...viewProps} />}

      {/* Saving spinner overlay */}
      {saving && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </div>
        </div>
      )}

      <EventFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialDate={addDate}
        event={editingEvent}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}




