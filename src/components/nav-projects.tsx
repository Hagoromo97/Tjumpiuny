"use client"

import { ChevronRight, Pencil, Settings2 } from "lucide-react"
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
  const isSearching = searchQuery.trim().length > 0
  const q = searchQuery.toLowerCase()

  const filteredSettings = isSearching
    ? settingsItems.filter(i => i.title.toLowerCase().includes(q))
    : settingsItems

  const showSettings = !isSearching
    ? true
    : ("settings".includes(q) || filteredSettings.length > 0)

  const showEditMode = !isSearching || "edit mode".includes(q) || "edit".includes(q)

  // Hide the whole section if search matches nothing in Projects
  if (isSearching && !showSettings && !showEditMode) return null

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

        {/* Edit Mode */}
        {showEditMode && (
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Edit Mode"
              onClick={onEditModeToggle}
              className={`transition-colors duration-150 ${
                isEditMode ? "text-primary font-medium bg-primary/10 hover:bg-primary/15" : ""
              }`}
            >
              <Pencil />
              <span>Edit Mode</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                isEditMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {isEditMode ? "ON" : "OFF"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
