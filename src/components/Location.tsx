import { useState, useEffect, useCallback, useMemo } from "react"
import { RefreshCw, Loader2, AlertCircle, AlertTriangle, Search, X, ChevronUp, ChevronDown as ChevronDownIcon, ChevronsUpDown, Filter, Save, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

// ─── Types ────────────────────────────────────────────────────────────────────
interface DeliveryPoint {
  code: string
  name: string
  delivery: "Daily" | "Weekday" | "Alt 1" | "Alt 2" | string
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
  qrCodeImageUrl?: string
  qrCodeDestinationUrl?: string
}

interface Route {
  id: string
  name: string
  code: string
  shift: string
  deliveryPoints: DeliveryPoint[]
}

interface FlatPoint extends DeliveryPoint {
  routeId: string
  routeName: string
  routeCode: string
  routeShift: string
  _rowIndex: number
  _dupCode: boolean
  _dupName: boolean
}

type SortKey = "code" | "name" | "delivery" | "route"
type SortDir = "asc" | "desc"

// ─── Delivery option definitions ─────────────────────────────────────────────
interface DeliveryItem {
  value: string
  label: string
  description: string
  color: string   // Tailwind bg class for the badge
  textColor: string
}

const DELIVERY_ITEMS: DeliveryItem[] = [
  {
    value: "Daily",
    label: "Daily",
    description: "Delivery every day",
    color: "bg-emerald-100 dark:bg-emerald-900/40",
    textColor: "text-emerald-700 dark:text-emerald-300",
  },
  {
    value: "Alt 1",
    label: "Alt 1",
    description: "Delivery on odd dates (1, 3, 5…)",
    color: "bg-violet-100 dark:bg-violet-900/40",
    textColor: "text-violet-700 dark:text-violet-300",
  },
  {
    value: "Alt 2",
    label: "Alt 2",
    description: "Delivery on even dates (2, 4, 6…)",
    color: "bg-fuchsia-100 dark:bg-fuchsia-900/40",
    textColor: "text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    value: "Weekday",
    label: "Weekday",
    description: "Sun – Thu",
    color: "bg-sky-100 dark:bg-sky-900/40",
    textColor: "text-sky-700 dark:text-sky-300",
  },
  {
    value: "Weekday 2",
    label: "Weekday 2",
    description: "Mon – Fri",
    color: "bg-blue-100 dark:bg-blue-900/40",
    textColor: "text-blue-700 dark:text-blue-300",
  },
  {
    value: "Weekday 3",
    label: "Weekday 3",
    description: "Sun, Tue & Fri only",
    color: "bg-indigo-100 dark:bg-indigo-900/40",
    textColor: "text-indigo-700 dark:text-indigo-300",
  },
]

const DELIVERY_MAP = new Map(DELIVERY_ITEMS.map(d => [d.value, d]))

function DeliveryBadge({ value, dirty }: { value: string; dirty?: boolean }) {
  const item = DELIVERY_MAP.get(value)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-offset-background transition-all",
        item ? `${item.color} ${item.textColor}` : "bg-muted text-muted-foreground",
        dirty && "ring-2 ring-primary ring-offset-1",
      )}
    >
      {value || "—"}
      <ChevronDownIcon className="w-3 h-3 opacity-60" />
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DeliveryTableDialog() {
  const [routes, setRoutes]   = useState<Route[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Pending edits: key = `${routeId}::${rowIndex}`, value = new delivery string
  const [pendingEdits, setPendingEdits] = useState<Map<string, string>>(new Map())
  const [isSaving, setIsSaving]         = useState(false)
  const [saveError, setSaveError]       = useState<string | null>(null)

  // Search & Filter
  const [search, setSearch]           = useState("")
  const [filterRoute, setFilterRoute] = useState("")
  const [filterDelivery, setFilterDelivery] = useState("")

  // Sort — default: code asc
  const [sortKey, setSortKey] = useState<SortKey>("code")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/routes")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setRoutes(json.data ?? json ?? [])
      setPendingEdits(new Map())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

  // ── Pending-edit helpers ─────────────────────────────────────────────────
  const pointKey = (pt: FlatPoint) => `${pt.routeId}::${pt._rowIndex}`

  const effectiveDelivery = (pt: FlatPoint) =>
    pendingEdits.get(pointKey(pt)) ?? pt.delivery

  const saveChanges = async () => {
    if (pendingEdits.size === 0 || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const updatedRoutes = routes.map(route => ({
        ...route,
        deliveryPoints: (route.deliveryPoints ?? []).map((pt, i) => {
          const key = `${route.id}::${i}`
          return pendingEdits.has(key) ? { ...pt, delivery: pendingEdits.get(key)! } : pt
        }),
      }))
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes: updatedRoutes }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRoutes(updatedRoutes)
      setPendingEdits(new Map())
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Flatten all points + detect duplicates ───────────────────────────────
  const { flat, dupCodeCount, dupNameCount } = useMemo(() => {
    const all: FlatPoint[] = []
    routes.forEach(route => {
      (route.deliveryPoints ?? []).forEach((pt, i) => {
        all.push({ ...pt, routeId: route.id, routeName: route.name, routeCode: route.code, routeShift: route.shift ?? "", _rowIndex: i, _dupCode: false, _dupName: false })
      })
    })
    const codeCounts: Record<string, number> = {}
    const nameCounts: Record<string, number> = {}
    all.forEach(p => {
      codeCounts[p.code.trim().toLowerCase()] = (codeCounts[p.code.trim().toLowerCase()] ?? 0) + 1
      nameCounts[p.name.trim().toLowerCase()] = (nameCounts[p.name.trim().toLowerCase()] ?? 0) + 1
    })
    let dupCodeCount = 0
    let dupNameCount = 0
    all.forEach(p => {
      p._dupCode = codeCounts[p.code.trim().toLowerCase()] > 1
      p._dupName = nameCounts[p.name.trim().toLowerCase()] > 1
      if (p._dupCode) dupCodeCount++
      if (p._dupName) dupNameCount++
    })
    return { flat: all, dupCodeCount, dupNameCount }
  }, [routes])

  // ── Unique options for filters ─────────────────────────────────────────
  const routeOptions = useMemo(() =>
    [...new Map(routes.map(r => [r.id, `${r.name} (${r.code})`])).entries()],
  [routes])
  const deliveryOptions = useMemo(() => {
    const known = DELIVERY_ITEMS.map(d => d.value)
    const extra = flat.map(p => p.delivery).filter(v => !DELIVERY_MAP.has(v))
    return [...known, ...new Set(extra)]
  }, [flat])

  // ── Filter + Sort ──────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = flat
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.routeName.toLowerCase().includes(q) ||
        p.routeCode.toLowerCase().includes(q) ||
        p.delivery.toLowerCase().includes(q)
      )
    }
    if (filterRoute)    list = list.filter(p => p.routeId === filterRoute)
    if (filterDelivery) list = list.filter(p => p.delivery === filterDelivery)

    return [...list].sort((a, b) => {
      let av = "", bv = ""
      if (sortKey === "code")     { av = a.code;      bv = b.code }
      if (sortKey === "name")     { av = a.name;      bv = b.name }
      if (sortKey === "delivery") { av = a.delivery;  bv = b.delivery }
      if (sortKey === "route")    { av = a.routeName; bv = b.routeName }
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [flat, search, filterRoute, filterDelivery, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="inline w-3 h-3 ml-0.5 text-muted-foreground/40" />
    return sortDir === "asc"
      ? <ChevronUp className="inline w-3 h-3 ml-0.5 text-primary" />
      : <ChevronDownIcon className="inline w-3 h-3 ml-0.5 text-primary" />
  }

  const totalPoints = flat.length

  return (
    <div className="flex flex-col flex-1 min-h-0 border rounded-xl overflow-hidden shadow-sm bg-background">

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b bg-muted/40 shrink-0">
        <span className="text-xs text-muted-foreground">
          {!loading && !error && `${displayed.length} / ${totalPoints} point(s) · ${routes.length} route(s)`}
        </span>
        {!loading && !error && dupCodeCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" />{dupCodeCount} dup code
          </span>
        )}
        {!loading && !error && dupNameCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" />{dupNameCount} dup name
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={fetchRoutes} disabled={loading || isSaving} className="ml-auto h-7 gap-1.5 text-xs">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
        {pendingEdits.size > 0 && (
          <Button
            size="sm"
            variant="default"
            onClick={saveChanges}
            disabled={isSaving}
            className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90"
          >
            {isSaving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Save className="w-3.5 h-3.5" />}
            {isSaving ? "Saving…" : `Save (${pendingEdits.size})`}
          </Button>
        )}
        {saveError && (
          <span className="flex items-center gap-1 text-xs font-medium text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />{saveError}
          </span>
        )}
      </div>

      {/* ── Search + Filter Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-muted/20 shrink-0">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search code, name, route…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-8 h-8 text-xs rounded-lg"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <select
            value={filterRoute}
            onChange={e => setFilterRoute(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Routes</option>
            {routeOptions.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <select
          value={filterDelivery}
          onChange={e => setFilterDelivery(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Delivery</option>
          {deliveryOptions.map(d => {
            const item = DELIVERY_MAP.get(d)
            return <option key={d} value={d}>{item ? `${item.label} – ${item.description}` : d}</option>
          })}
        </select>
        {(search || filterRoute || filterDelivery) && (
          <button
            onClick={() => { setSearch(""); setFilterRoute(""); setFilterDelivery("") }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >Clear</button>
        )}
      </div>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && !flat.length && (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm loading-text">Loading routes…</span>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="flex flex-1 items-center justify-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* ── Table — fills remaining height, scrolls inside ── */}
      {(!loading || flat.length > 0) && !error && (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="border-collapse text-sm whitespace-nowrap min-w-max w-full">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm text-xs uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="px-3 py-3 text-center w-10">#</th>
                <th className="px-3 py-3 text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("route")}>
                  Route <SortIcon col="route" />
                </th>
                <th className="px-3 py-3 text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("code")}>
                  Code <SortIcon col="code" />
                </th>
                <th className="px-3 py-3 text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("name")}>
                  Location Name <SortIcon col="name" />
                </th>
                <th className="px-3 py-3 text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("delivery")}>
                  Delivery <SortIcon col="delivery" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-muted-foreground">
                    No results found.
                  </td>
                </tr>
              ) : (
                displayed.map((pt, idx) => (
                  <tr
                    key={`${pt.routeId}-${pt.code}-${idx}`}
                    className={cn(
                      "transition-colors",
                      (pt._dupCode || pt._dupName)
                        ? "bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-100/60 dark:hover:bg-amber-900/20"
                        : idx % 2 === 0 ? "hover:bg-muted/40" : "bg-muted/20 hover:bg-muted/40"
                    )}
                  >
                    <td className="px-3 py-3 text-center text-muted-foreground w-10 text-xs tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs text-foreground">{pt.routeName}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("font-mono text-xs font-medium", pt._dupCode && "text-amber-600 dark:text-amber-400 font-bold")}>
                        {pt.code}
                      </span>
                      {pt._dupCode && <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-500" />}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("text-xs", pt._dupName && "text-rose-600 dark:text-rose-400 font-semibold")}>
                        {pt.name}
                      </span>
                      {pt._dupName && <AlertTriangle className="inline w-3 h-3 ml-1 text-rose-500" />}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {effectiveDelivery(pt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}

