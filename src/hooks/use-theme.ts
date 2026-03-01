import { useEffect, useState } from "react"

export type ColorMode = "light" | "dark"
export type ColorTheme =
  | "default"
  | "bubblegum"
  | "candyland"
  | "claude"
  | "cyberpunk"
  | "northern-lights"
  | "ocean-breeze"

export type AppFont =
  | "system"
  | "inter"
  | "poppins"
  | "roboto"
  | "nunito"
  | "plus-jakarta-sans"

export const FONT_OPTIONS: { id: AppFont; label: string; family: string; googleId?: string }[] = [
  { id: "system",           label: "System Default", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: "inter",            label: "Inter",           family: "'Inter', sans-serif",            googleId: "Inter:wght@300;400;500;600;700" },
  { id: "poppins",          label: "Poppins",         family: "'Poppins', sans-serif",          googleId: "Poppins:wght@300;400;500;600;700" },
  { id: "roboto",           label: "Roboto",          family: "'Roboto', sans-serif",           googleId: "Roboto:wght@300;400;500;700" },
  { id: "nunito",           label: "Nunito",          family: "'Nunito', sans-serif",           googleId: "Nunito:wght@300;400;500;600;700" },
  { id: "plus-jakarta-sans",label: "Plus Jakarta Sans",family: "'Plus Jakarta Sans', sans-serif",googleId: "Plus+Jakarta+Sans:wght@300;400;500;600;700" },
]

export type AppZoom = "80" | "85" | "90" | "95" | "100" | "105" | "110" | "115" | "120"
export type TextSize = "13" | "14" | "15" | "16" | "17" | "18" | "20"

/** Inject a Google Fonts <link> once per font id */
const loadedFonts = new Set<string>()
function loadGoogleFont(googleId: string) {
  if (loadedFonts.has(googleId)) return
  loadedFonts.add(googleId)
  const link = document.createElement("link")
  link.rel  = "stylesheet"
  link.href = `https://fonts.googleapis.com/css2?family=${googleId}&display=swap`
  document.head.appendChild(link)
}

export function useTheme() {
  const [mode, setMode] = useState<ColorMode>(() => {
    const stored = localStorage.getItem("color-mode") as ColorMode | null
    if (stored === "light" || stored === "dark") return stored
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const stored = localStorage.getItem("color-theme") as ColorTheme | null
    return stored ?? "default"
  })

  const [appFont, setAppFont] = useState<AppFont>(() => {
    return (localStorage.getItem("app-font") as AppFont | null) ?? "inter"
  })

  const [appZoom, setAppZoom] = useState<AppZoom>(() => {
    return (localStorage.getItem("app-zoom") as AppZoom | null) ?? "100"
  })

  const [textSize, setTextSize] = useState<TextSize>(() => {
    return (localStorage.getItem("text-size") as TextSize | null) ?? "16"
  })

  // Color mode + theme
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", mode === "dark")
    root.classList.toggle("light", mode === "light")
    if (colorTheme === "default") {
      root.removeAttribute("data-theme")
    } else {
      root.setAttribute("data-theme", colorTheme)
    }
    localStorage.setItem("color-mode", mode)
    localStorage.setItem("color-theme", colorTheme)
    const color = mode === "dark" ? "#1a1a2e" : "#ffffff"
    const allMetas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    if (allMetas.length === 0) {
      const meta = document.createElement("meta")
      meta.name = "theme-color"
      meta.setAttribute("content", color)
      document.head.appendChild(meta)
    } else {
      allMetas.forEach((meta) => meta.setAttribute("content", color))
    }
  }, [mode, colorTheme])

  // Font
  useEffect(() => {
    const opt = FONT_OPTIONS.find(f => f.id === appFont)
    if (!opt) return
    if (opt.googleId) loadGoogleFont(opt.googleId)
    document.documentElement.style.setProperty("--app-font", opt.family)
    document.body.style.fontFamily = opt.family
    localStorage.setItem("app-font", appFont)
  }, [appFont])

  // App zoom (scales entire layout)
  useEffect(() => {
    document.documentElement.style.zoom = `${appZoom}%`
    localStorage.setItem("app-zoom", appZoom)
  }, [appZoom])

  // Text size — stored in CSS custom property so DeviceProvider can scale it
  useEffect(() => {
    document.documentElement.style.setProperty("--text-size-base", `${textSize}px`)
    localStorage.setItem("text-size", textSize)
  }, [textSize])

  const toggleMode = () => setMode((prev) => (prev === "light" ? "dark" : "light"))

  // Backward-compat alias used by old ThemeToggle
  const theme = mode
  const setTheme = setMode
  const toggleTheme = toggleMode

  return {
    theme, setTheme, toggleTheme,
    mode, setMode, toggleMode,
    colorTheme, setColorTheme,
    appFont, setAppFont,
    appZoom, setAppZoom,
    textSize, setTextSize,
  }
}
