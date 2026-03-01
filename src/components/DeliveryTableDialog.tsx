import { useState, useEffect, useCallback, useMemo } from "react"
import { RefreshCw, Loader2, AlertCircle, AlertTriangle, Search, X, ChevronUp, ChevronDown, ChevronsUpDown, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

// ─── Main Component ───────────────────────────────────────────────────────────
export function DeliveryTableDialog() {
  const [routes, setRoutes]   = useState<Route[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

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
  const deliveryOptions = useMemo(() =>
    [...new Set(flat.map(p => p.delivery))].sort(),
  [flat])

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
      : <ChevronDown className="inline w-3 h-3 ml-0.5 text-primary" />
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
        <Button size="sm" variant="ghost" onClick={fetchRoutes} disabled={loading} className="ml-auto h-7 gap-1.5 text-xs">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
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
          {deliveryOptions.map(d => <option key={d} value={d}>{d}</option>)}
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
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading routes…</span>
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
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs text-foreground">{pt.delivery}</span>
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

