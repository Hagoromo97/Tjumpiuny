"use client"

import { ChevronRight, Moon, Pencil, Settings2, Sun } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/hooks/use-theme"

interface SettingsItem {
  title: string
  page: string
}

export function NavProjects({
  settingsItems,
  settingsOpen,
  onSettingsOpenChange,
  currentPage,
  onNavigate,
  isEditMode,
  onEditModeToggle,
  searchQuery = "",
}: {
  settingsItems: SettingsItem[]
  settingsOpen: boolean
  onSettingsOpenChange: (open: boolean) => void
  currentPage?: string
  onNavigate?: (page: string) => void
  isEditMode: boolean
  onEditModeToggle: () => void
  searchQuery?: string
}) {
  const { mode, toggleMode } = useTheme()
  const isSearching = searchQuery.trim().length > 0
  const q = searchQuery.toLowerCase()

  const filteredSettings = isSearching
    ? settingsItems.filter(i => i.title.toLowerCase().includes(q))
    : settingsItems

  const showDarkMode  = !isSearching || "dark mode".includes(q) || "light mode".includes(q) || "appearance".includes(q)
  const showEditMode  = !isSearching || "edit mode".includes(q) || "edit".includes(q)

  const showSettings = !isSearching
    ? true
    : ("settings".includes(q) || filteredSettings.length > 0 || showDarkMode || showEditMode)

  // Hide entire section if nothing matches
  if (isSearching && !showSettings) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {/* Settings collapsible */}
        {showSettings && (
          <Collapsible
            asChild
            open={isSearching ? true : settingsOpen}
            onOpenChange={v => { if (!isSearching) onSettingsOpenChange(v) }}
          >
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                className="transition-colors duration-150"
                onClick={() => { if (!isSearching) onSettingsOpenChange(!settingsOpen) }}
              >
                <Settings2 />
                <span>Settings</span>
              </SidebarMenuButton>
              <CollapsibleTrigger asChild>
                <SidebarMenuAction className="transition-transform duration-300 data-[state=open]:rotate-90">
                  <ChevronRight />
                  <span className="sr-only">Toggle</span>
                </SidebarMenuAction>
              </CollapsibleTrigger>
              <CollapsibleContent className="nav-collapsible-content">
                <SidebarMenuSub>

                  {/* ── Dark Mode toggle ── */}
                  {showDarkMode && (
                    <SidebarMenuSubItem>
                      <div className="flex items-center gap-2 px-2 py-1.5 w-full rounded-md hover:bg-sidebar-accent/50 transition-colors cursor-pointer" onClick={toggleMode}>
                        {mode === "dark"
                          ? <Moon className="size-3.5 shrink-0 text-sidebar-foreground/70" />
                          : <Sun  className="size-3.5 shrink-0 text-sidebar-foreground/70" />}
                        <span className="flex-1 text-sm text-sidebar-foreground/90">Dark Mode</span>
                        <span onClick={e => e.stopPropagation()}>
                          <Switch
                            size="sm"
                            checked={mode === "dark"}
                            onCheckedChange={toggleMode}
                          />
                        </span>
                      </div>
                    </SidebarMenuSubItem>
                  )}

                  {/* ── Edit Mode toggle ── */}
                  {showEditMode && (
                    <SidebarMenuSubItem>
                      <div
                        className={`flex items-center gap-2 px-2 py-1.5 w-full rounded-md transition-colors cursor-pointer ${
                          isEditMode ? "text-primary hover:bg-primary/10" : "hover:bg-sidebar-accent/50"
                        }`}
                        onClick={onEditModeToggle}
                      >
                        <Pencil className={`size-3.5 shrink-0 ${isEditMode ? "text-primary" : "text-sidebar-foreground/70"}`} />
                        <span className={`flex-1 text-sm ${isEditMode ? "text-primary font-medium" : "text-sidebar-foreground/90"}`}>Edit Mode</span>
                        <span onClick={e => e.stopPropagation()}>
                          <Switch
                            size="sm"
                            checked={isEditMode}
                            onCheckedChange={onEditModeToggle}
                          />
                        </span>
                      </div>
                    </SidebarMenuSubItem>
                  )}

                  {/* ── Nav settings items ── */}
                  {filteredSettings.map(item => (
                    <SidebarMenuSubItem key={item.page}>
                      <SidebarMenuSubButton
                        asChild
                        className="transition-colors duration-150"
                        isActive={currentPage === item.page}
                      >
                        <a
                          href="#"
                          onClick={e => { e.preventDefault(); onNavigate?.(item.page) }}
                        >
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}

                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
