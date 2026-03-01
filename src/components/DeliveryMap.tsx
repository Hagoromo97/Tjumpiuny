import { useMemo, useState, useEffect, useRef } from "react"
import { GoogleMap, useLoadScript, InfoWindow } from "@react-google-maps/api"

const GMAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LIBRARIES = ["marker"] as any

const DELIVERY_COLORS: Record<string, string> = {
  Daily:   "#22c55e",
  Weekday: "#3b82f6",
  "Alt 1": "#eab308",
  "Alt 2": "#a855f7",
}

interface DeliveryPoint {
  code: string
  name: string
  delivery: "Daily" | "Weekday" | "Alt 1" | "Alt 2"
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
}

interface DeliveryMapProps {
  deliveryPoints: DeliveryPoint[]
  scrollZoom?: boolean
}

const MAP_OPTIONS: google.maps.MapOptions = {
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  mapId: "DEMO_MAP_ID",
}

/** Colored dot HTMLElement for AdvancedMarkerElement */
function createDotElement(color: string): HTMLElement {
  const dot = document.createElement("div")
  dot.style.cssText = `
    width: 14px;
    height: 14px;
    background: ${color};
    border: 2.5px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    cursor: pointer;
    transition: width 0.15s ease, height 0.15s ease;
  `
  return dot
}

export function DeliveryMap({ deliveryPoints, scrollZoom = false }: DeliveryMapProps) {
  const { isLoaded } = useLoadScript({ googleMapsApiKey: GMAP_KEY, libraries: LIBRARIES })
  const [activeCode,   setActiveCode]   = useState<string | null>(null)
  const [mapInstance,  setMapInstance]  = useState<google.maps.Map | null>(null)

  const markersRef = useRef<Array<{
    marker: google.maps.marker.AdvancedMarkerElement
    el: HTMLElement
    code: string
    color: string
  }>>([])

  const validPoints = useMemo(
    () => deliveryPoints.filter((p) => p.latitude !== 0 && p.longitude !== 0),
    [deliveryPoints]
  )

  const activePoint = useMemo(
    () => validPoints.find(p => p.code === activeCode) ?? null,
    [validPoints, activeCode]
  )

  const center = useMemo(() => {
    if (validPoints.length === 0) return { lat: 3.15, lng: 101.65 }
    return {
      lat: validPoints.reduce((s, p) => s + p.latitude, 0) / validPoints.length,
      lng: validPoints.reduce((s, p) => s + p.longitude, 0) / validPoints.length,
    }
  }, [validPoints])

  // Create AdvancedMarkerElement for each point
  useEffect(() => {
    if (!mapInstance) return
    markersRef.current.forEach(({ marker }) => { marker.map = null })
    markersRef.current = []

    validPoints.forEach(point => {
      const color = DELIVERY_COLORS[point.delivery] ?? "#6b7280"
      const el    = createDotElement(color)

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map:      mapInstance,
        position: { lat: point.latitude, lng: point.longitude },
        content:  el,
        title:    point.name,
      })

      marker.addListener("click", () =>
        setActiveCode(prev => prev === point.code ? null : point.code)
      )

      markersRef.current.push({ marker, el, code: point.code, color })
    })

    return () => {
      markersRef.current.forEach(({ marker }) => { marker.map = null })
      markersRef.current = []
    }
  }, [mapInstance, validPoints])

  // Scale active marker without recreating
  useEffect(() => {
    markersRef.current.forEach(({ el, code }) => {
      const isActive    = code === activeCode
      el.style.width    = isActive ? "18px" : "14px"
      el.style.height   = isActive ? "18px" : "14px"
      el.style.boxShadow = isActive
        ? "0 0 0 3px rgba(255,255,255,0.7), 0 3px 10px rgba(0,0,0,0.4)"
        : "0 2px 6px rgba(0,0,0,0.35)"
    })
  }, [activeCode])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={center}
      zoom={13}
      options={{
        ...MAP_OPTIONS,
        scrollwheel: scrollZoom,
        gestureHandling: scrollZoom ? "greedy" : "cooperative",
      }}
      onLoad={(map) => {
        setMapInstance(map)
        if (validPoints.length > 1) {
          const bounds = new google.maps.LatLngBounds()
          validPoints.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }))
          map.fitBounds(bounds, 30)
        } else if (validPoints.length === 1) {
          map.setCenter({ lat: validPoints[0].latitude, lng: validPoints[0].longitude })
          map.setZoom(13)
        }
      }}
      onClick={() => setActiveCode(null)}
    >
      {activePoint && (
        <InfoWindow
          position={{ lat: activePoint.latitude, lng: activePoint.longitude }}
          onCloseClick={() => setActiveCode(null)}
          options={{ pixelOffset: new google.maps.Size(0, -12) }}
        >
          <div className="text-sm">
            <strong className="block mb-1">{activePoint.name}</strong>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>Code: {activePoint.code}</div>
              <div>Delivery: {activePoint.delivery}</div>
              <div className="font-mono">{activePoint.latitude.toFixed(4)}, {activePoint.longitude.toFixed(4)}</div>
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
