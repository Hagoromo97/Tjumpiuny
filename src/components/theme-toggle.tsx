import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="size-9"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Moon className="size-4 transition-all" />
      ) : (
        <Sun className="size-4 transition-all" />
      )}
    </Button>
  )
}
