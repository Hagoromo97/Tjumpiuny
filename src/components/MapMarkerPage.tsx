import { useState, useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MapPin, Filter, Plus, X, Check, Info, Route as RouteIcon } from "lucide-react"

/* ─── Leaflet icon factory ────────────────────────────────────────────────── */
function makeIcon(color: string, isCustom = false, selected = false): L.DivIcon {
  const size = selected ? 22 : 16
  const svg = isCustom
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${size}" height="${Math.round(size*1.5)}">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9.188 12 24 12 24S24 21.188 24 12C24 5.373 18.627 0 12 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" font-size="10" fill="white" font-family="Arial">★</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${size}" height="${Math.round(size*1.5)}">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9.188 12 24 12 24S24 21.188 24 12C24 5.373 18.627 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="12" cy="11.5" r="4.5" fill="white" opacity="0.9"/>
      </svg>`
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, Math.round(size*1.5)],
    iconAnchor: [size/2, Math.round(size*1.5)],
    popupAnchor: [0, -Math.round(size*1.5)],
  })
}

/* ─── Map fly-to controller ───────────────────────────────────────────────── */
function MapController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap()
  const prev = useRef<string | null>(null)
  useEffect(() => {
    if (!center) return
    const key = center.join(",")
    if (key === prev.current) return
    prev.current = key
    map.flyTo(center, zoom ?? 15, { duration: 0.8 })
  }, [center, zoom, map])
  return null
}

/* ─── Auto fit bounds controller ──────────────────────────────────────────── */
function AutoFitBounds({ markers, selectedRouteIds, deliveryFilter }: { markers: Marker[]; selectedRouteIds: Set<string>; deliveryFilter: string }) {
  const map = useMap()
  const prevFilterKey = useRef<string>("")

  useEffect(() => {
    // Only auto-fit when filters are active (not "All Routes" and "All" delivery)
    const hasFilter = selectedRouteIds.size > 0 || deliveryFilter !== "All"
    if (!hasFilter) return

    const filterKey = `${Array.from(selectedRouteIds).sort().join(",")}-${deliveryFilter}`
    if (filterKey === prevFilterKey.current) return
    prevFilterKey.current = filterKey

    const validMarkers = markers.filter(m => m.hasCoords)
    if (validMarkers.length === 0) return

    if (validMarkers.length === 1) {
      // Single marker - just zoom to it
      const m = validMarkers[0]
      map.flyTo([m.lat, m.lng], 15, { duration: 0.8 })
      return
    }

    // Multiple markers - fit bounds to show all
    const bounds = L.latLngBounds(validMarkers.map(m => [m.lat, m.lng]))
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 16,
      duration: 0.8,
    })
  }, [markers, selectedRouteIds, deliveryFilter, map])

  return null
}

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface DeliveryPoint {
  code: string
  name: string
  delivery: "Daily" | "Weekday" | "Alt 1" | "Alt 2"
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
}

interface Route {
  id: string
  name: string
  code: string
  shift: string
  deliveryPoints: DeliveryPoint[]
}

interface Marker {
  id: string
  lat: number
  lng: number
  title: string
  code?: string
  delivery?: string
  routeId?: string
  routeName?: string
  routeCode?: string
  routeShift?: string
  isFromRoute: boolean
  hasCoords: boolean
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const DELIVERY_COLORS: Record<string, string> = {
  Daily:   "#22c55e",
  Weekday: "#3b82f6",
  "Alt 1": "#eab308",
  "Alt 2": "#a855f7",
}

const DELIVERY_TYPES = ["All", "Daily", "Weekday", "Alt 1", "Alt 2"]

const FALLBACK_CENTER = { lat: 3.0695500, lng: 101.5469179 }

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function routesToMarkers(routes: Route[]): Marker[] {
  const markers: Marker[] = []
  for (const route of routes) {
    for (const dp of route.deliveryPoints) {
      const hasCoords = !!(dp.latitude && dp.longitude && (dp.latitude !== 0 || dp.longitude !== 0))
      markers.push({
        id: `${route.id}-${dp.code}`,
        lat: hasCoords ? dp.latitude : 0,
        lng: hasCoords ? dp.longitude : 0,
        title: dp.name || dp.code,
        code: dp.code,
        delivery: dp.delivery,
        routeId: route.id,
        routeName: route.name,
        routeCode: route.code,
        routeShift: route.shift,
        isFromRoute: true,
        hasCoords,
      })
    }
  }
  return markers
}

/* ─── Add Marker Dialog ───────────────────────────────────────────────────── */
function AddMarkerDialog({
  open, onConfirm, onCancel,
}: { open: boolean; onConfirm: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("")
  useEffect(() => { if (open) setTitle("") }, [open])
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" /> Add Marker
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="marker-title">Marker Name</Label>
            <Input
              id="marker-title"
              placeholder="e.g. Main Branch..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && title.trim()) onConfirm(title.trim()) }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={() => { if (title.trim()) onConfirm(title.trim()) }}>
              <Plus className="size-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Filter Dialog ────────────────────────────────────────────────────────── */
function FilterDialog({
  open, onClose,
  deliveryFilter, setDeliveryFilter,
  selectedRouteIds, setSelectedRouteIds,
  routes,
}: {
  open: boolean; onClose: () => void
  deliveryFilter: string; setDeliveryFilter: (v: string) => void
  selectedRouteIds: Set<string>; setSelectedRouteIds: (v: Set<string>) => void
  routes: Route[]
}) {
  const toggleRoute = (id: string) => {
    const n = new Set(selectedRouteIds)
    if (n.has(id)) n.delete(id); else n.add(id)
    setSelectedRouteIds(n)
  }
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="size-4" /> Filter Markers
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Type</p>
            <div className="flex flex-wrap gap-1.5">
              {DELIVERY_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setDeliveryFilter(type)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    deliveryFilter === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {type !== "All" && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DELIVERY_COLORS[type] }} />
                  )}
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Route</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedRouteIds(new Set())}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                  selectedRouteIds.size === 0
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <span className={`flex size-4 items-center justify-center rounded border-2 shrink-0 ${selectedRouteIds.size === 0 ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                  {selectedRouteIds.size === 0 && <Check className="size-2.5 text-white" />}
                </span>
                All Routes
              </button>
              {routes.map(route => {
                const sel = selectedRouteIds.has(route.id)
                return (
                  <button key={route.id} onClick={() => toggleRoute(route.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                      sel
                        ? "bg-primary/10 border-primary text-primary font-medium"
                        : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span className={`flex size-4 items-center justify-center rounded border-2 shrink-0 ${sel ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                      {sel && <Check className="size-2.5 text-white" />}
                    </span>
                    <span className="flex-1 text-left truncate">{route.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{route.code}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex justify-between items-center pt-1">
            <Button variant="outline" size="sm" onClick={() => { setDeliveryFilter("All"); setSelectedRouteIds(new Set()) }}>Reset</Button>
            <Button size="sm" onClick={onClose}>Apply Filter</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}



/* ─── Main Component ──────────────────────────────────────────────────────── */
export function MapMarkerPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [deliveryFilter, setDeliveryFilter] = useState("All")
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(new Set())
  const [mapCenter, setMapCenter] = useState<[number, number]>([FALLBACK_CENTER.lat, FALLBACK_CENTER.lng])

  useEffect(() => {
    fetch("/api/routes")
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.length > 0) {
          setRoutes(data.data)
          const ms = routesToMarkers(data.data)
          setMarkers(ms)
          if (ms.length > 0) {
            const avgLat = ms.reduce((s, m) => s + m.lat, 0) / ms.length
            const avgLng = ms.reduce((s, m) => s + m.lng, 0) / ms.length
            setMapCenter([avgLat, avgLng])
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const filteredMarkers = markers.filter(m => {
    if (deliveryFilter !== "All" && m.delivery !== deliveryFilter) return false
    if (selectedRouteIds.size > 0 && m.isFromRoute) {
      if (!m.routeId || !selectedRouteIds.has(m.routeId)) return false
    }
    return true
  })

  const routeMarkers = filteredMarkers.filter(m => m.isFromRoute)
  const customMarkers = filteredMarkers.filter(m => !m.isFromRoute)

  const handleAddMarker = (title: string) => {
    const spread = 0.04
    const newMarker: Marker = {
      id: `custom-${Date.now()}`,
      lat: mapCenter[0] + (Math.random() - 0.5) * spread,
      lng: mapCenter[1] + (Math.random() - 0.5) * spread,
      title,
      isFromRoute: false,
      hasCoords: true,
    }
    setMarkers(prev => [...prev, newMarker])
    setSelectedMarker(newMarker)
    setFlyTarget([newMarker.lat, newMarker.lng])
    setAddOpen(false)
  }

  const removeMarker = (id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id))
    if (selectedMarker?.id === id) setSelectedMarker(null)
  }

  const allRoutePoints = routes.flatMap(r => r.deliveryPoints)
  const pointsWithCoords = allRoutePoints.filter(dp => dp.latitude !== 0 || dp.longitude !== 0)
  const pointsNoCoords = allRoutePoints.length - pointsWithCoords.length

  const deliveryCounts: Record<string, number> = { All: routeMarkers.length }
  for (const m of routeMarkers) {
    if (m.delivery) deliveryCounts[m.delivery] = (deliveryCounts[m.delivery] ?? 0) + 1
  }

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto">
      <div className="space-y-4 p-4 md:p-6">

        {/* ── Map Card ── */}
        <Card className="rounded-2xl bg-card/80 backdrop-blur-xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-3 px-6 pt-6">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="size-5 text-blue-500" />
                Map Marker
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  · {filteredMarkers.filter(m => m.hasCoords || !m.isFromRoute).length} on map
                  {filteredMarkers.filter(m => !m.hasCoords && m.isFromRoute).length > 0 && (
                    <span className="ml-1 text-amber-500 text-xs">
                      · {filteredMarkers.filter(m => !m.hasCoords && m.isFromRoute).length} no coordinates
                    </span>
                  )}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => setFilterOpen(true)}
                >
                  <Filter className="size-3.5" />
                  Filter
                  {(deliveryFilter !== "All" || selectedRouteIds.size > 0) && (
                    <span className="ml-0.5 bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 py-0.5 font-bold">
                      {(deliveryFilter !== "All" ? 1 : 0) + selectedRouteIds.size}
                    </span>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Add Marker
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            {/* React Leaflet Map */}
            <div className="relative rounded-xl overflow-hidden border border-border/30" style={{ height: 420 }}>
              <MapContainer
                center={mapCenter}
                zoom={12}
                style={{ width: "100%", height: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController center={flyTarget} />
                <AutoFitBounds markers={filteredMarkers} selectedRouteIds={selectedRouteIds} deliveryFilter={deliveryFilter} />
                {filteredMarkers.filter(m => m.hasCoords || !m.isFromRoute).map(m => {
                  const color = m.delivery ? (DELIVERY_COLORS[m.delivery] ?? "#6b7280") : "#ef4444"
                  const isSelected = selectedMarker?.id === m.id
                  return (
                    <Marker
                      key={m.id}
                      position={[m.lat, m.lng]}
                      icon={makeIcon(color, !m.isFromRoute, isSelected)}
                      eventHandlers={{
                        click: () => {
                          setSelectedMarker(m)
                          setFlyTarget([m.lat, m.lng])
                        },
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[160px]">
                          <p className="font-semibold mb-1">{m.title}</p>
                          {m.code && <p className="text-xs text-gray-500">#{m.code}</p>}
                          {m.routeName && <p className="text-xs text-gray-500">{m.routeName} · {m.routeShift}</p>}
                          {m.delivery && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 px-2 py-0.5 rounded-full" style={{ background: color + "25", color }}>
                              {m.delivery}
                            </span>
                          )}
                          {!m.isFromRoute && <p className="text-[11px] text-red-500 mt-1">📍 Custom Pin</p>}
                          <p className="text-[10px] font-mono text-gray-400 mt-1.5">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</p>
                          {!m.isFromRoute && (
                            <button
                              onClick={() => removeMarker(m.id)}
                              className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                            >
                              <X className="size-3" /> Remove
                            </button>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
              {/* Legend */}
              <div className="absolute bottom-3 right-3 z-[1000] bg-background/92 backdrop-blur-md border border-border/50 rounded-xl shadow-lg px-3 py-2 space-y-1 pointer-events-none">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Legend</p>
                {Object.entries(DELIVERY_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    {type}
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border-t border-border/30 pt-1 mt-1">
                  <span className="text-red-500 text-xs leading-none">★</span> Custom
                </div>
              </div>
            </div>

            {/* Marker list */}
            <div className="max-h-64 overflow-y-auto">
              {filteredMarkers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <MapPin className="size-8 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">No locations found.</p>
                  <p className="text-xs text-muted-foreground/60">Add routes in Route List first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredMarkers.map(marker => {
                    const color = marker.delivery ? (DELIVERY_COLORS[marker.delivery] ?? "#6b7280") : "#ef4444"
                    const isSelected = selectedMarker?.id === marker.id
                    const noCoords = !marker.hasCoords && marker.isFromRoute
                    return (
                      <button
                        key={marker.id}
                        onClick={() => {
                          if (!noCoords) {
                            setSelectedMarker(marker)
                            setFlyTarget([marker.lat, marker.lng])
                          }
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          noCoords
                            ? "bg-muted/10 border-border/20 opacity-50 cursor-default"
                            : isSelected
                            ? "bg-primary/10 border-primary shadow-sm"
                            : "bg-muted/30 border-border/40 hover:bg-muted/60 hover:border-border"
                        }`}
                      >
                        {noCoords
                          ? <MapPin className="size-2.5 shrink-0 text-amber-400" />
                          : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : ""}`}>
                            {marker.title}
                          </p>
                          {marker.routeName && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {marker.routeCode} · {marker.routeShift} · #{marker.code}
                            </p>
                          )}
                          {noCoords && (
                            <p className="text-[10px] text-amber-500">No coordinates</p>
                          )}
                          {!marker.isFromRoute && (
                            <p className="text-[10px] text-red-400">Custom Pin</p>
                          )}
                        </div>
                        {!marker.isFromRoute && (
                          <button
                            onClick={e => { e.stopPropagation(); removeMarker(marker.id) }}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Stats Card ── */}
        <Card className="rounded-2xl bg-card/80 backdrop-blur-xl border-0 shadow-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base flex items-center gap-2">
              <RouteIcon className="size-4 text-blue-500" />
              Marker Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Markers", value: filteredMarkers.length, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "From Route", value: routeMarkers.length, color: "text-green-500", bg: "bg-green-500/10" },
                { label: "Custom Pins", value: customMarkers.length, color: "text-red-500", bg: "bg-red-500/10" },
                { label: "No Coordinates", value: pointsNoCoords, color: pointsNoCoords > 0 ? "text-amber-500" : "text-muted-foreground", bg: pointsNoCoords > 0 ? "bg-amber-500/10" : "bg-muted/30" },
              ].map(stat => (
                <div key={stat.label} className={`rounded-xl p-3 ${stat.bg}`}>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Type</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["Daily", "Weekday", "Alt 1", "Alt 2"].map(type => (
                  <button
                    key={type}
                    onClick={() => setDeliveryFilter(deliveryFilter === type ? "All" : type)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${
                      deliveryFilter === type
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/40 bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DELIVERY_COLORS[type] }} />
                      <span className="text-xs font-medium">{type}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-muted-foreground">{deliveryCounts[type] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Cara Guna ── */}
        <Card className="rounded-2xl border border-blue-500/10 bg-blue-500/5 shadow-none">
          <CardContent className="px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="size-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">How to Use Map Marker</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>• Markers are pulled automatically from <strong>Route List</strong> — any location with <strong>Latitude</strong> and <strong>Longitude</strong> filled in will appear as a marker.</li>
                  <li>• Locations <strong>without coordinates</strong> will not be shown on the map. Fill in coordinates in Route List first.</li>
                  <li>• Click <strong>Add Marker</strong> to place a custom pin anywhere on the map.</li>
                  <li>• Click a marker name in the list to fly to its position on the map.</li>
                  <li>• Use the <strong>Filter</strong> button to filter by delivery type or route — <strong>map automatically zooms</strong> to show all filtered markers.</li>
                  <li>• Click a delivery type in the stats section to quickly filter and auto-zoom to those markers.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      <AddMarkerDialog
        open={addOpen}
        onConfirm={handleAddMarker}
        onCancel={() => setAddOpen(false)}
      />
      <FilterDialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        deliveryFilter={deliveryFilter}
        setDeliveryFilter={setDeliveryFilter}
        selectedRouteIds={selectedRouteIds}
        setSelectedRouteIds={setSelectedRouteIds}
        routes={routes}
      />
    </div>
  )
}
