"use client"

import * as React from "react"
import {
  Calendar,
  Package,
  Search,
  X,
  Images,
} from "lucide-react"
import { useEditMode } from "@/contexts/EditModeContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  },
  navMain: [
    {
      title: "Full Calendar",
      url: "#",
      icon: Calendar,
      isActive: false,
      items: [
        {
          title: "Calendar",
          url: "#",
          page: "calendar-month",
        },
        {
          title: "Rooster",
          url: "#",
          page: "rooster",
        },
      ],
    },
    {
      title: "Vending Machine",
      url: "#",
      icon: Package,
      isActive: false,
      items: [
        {
          title: "Route List",
          url: "#",
          page: "route-list",
        },
        {
          title: "Location",
          url: "#",
          page: "deliveries",
        },
        {
          title: "Map Marker",
          url: "#",
          page: "map-marker",
        },
      ],
    },
    {
      title: "Gallery",
      url: "#",
      icon: Images,
      isActive: false,
      items: [
        {
          title: "Plano VM",
          url: "#",
          page: "plano-vm",
        },
        {
          title: "Album",
          url: "#",
          page: "gallery-album",
        },
      ],
    },
  ],
  settingsItems: [
    { title: "Profile",     page: "settings-profile" },
    { title: "Notifications", page: "settings-notifications" },
    { title: "Appearance",  page: "settings-appearance" },
    { title: "Font",        page: "settings-appearance-font" },
    { title: "Display",     page: "settings-appearance-display" },
    { title: "Map Settings",page: "settings-map" },
    { title: "Security",    page: "settings-security" },
  ],
}

const SETTINGS_PAGES = new Set([
  "settings-profile","settings-notifications","settings-appearance",
  "settings-appearance-font","settings-appearance-display","settings-map","settings-security",
])


export function AppSidebar({ 
  onNavigate,
  currentPage,
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  onNavigate?: (page: string) => void
  currentPage?: string
}) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [settingsOpen, setSettingsOpen] = React.useState(() => SETTINGS_PAGES.has(currentPage ?? ""))
  const [openNavItem, setOpenNavItem] = React.useState<string | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false)
  const { isEditMode, setIsEditMode, hasUnsavedChanges, saveChanges, isSaving, discardChanges } = useEditMode()

  // Mutually exclusive: opening a Platform submenu closes Settings, and vice versa
  const handleNavItemChange = (item: string | null) => {
    setOpenNavItem(item)
    if (item !== null) setSettingsOpen(false)
  }

  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open)
    if (open) setOpenNavItem(null)
  }

  const handleEditModeToggle = () => {
    if (isEditMode && hasUnsavedChanges) {
      setUnsavedDialogOpen(true)
    } else {
      setIsEditMode(!isEditMode)
    }
  }

  const filteredNavMain = React.useMemo(() => {
    if (!searchQuery.trim()) return data.navMain
    const q = searchQuery.toLowerCase()
    return data.navMain
      .map(item => {
        const titleMatch = item.title.toLowerCase().includes(q)
        const filteredSubs = item.items?.filter(sub => sub.title.toLowerCase().includes(q)) ?? []
        if (titleMatch) return item
        if (filteredSubs.length > 0) return { ...item, items: filteredSubs }
        return null
      })
      .filter(Boolean) as typeof data.navMain
  }, [searchQuery])

  const handleNavClick = (_itemTitle: string) => {
    // top-level items with children just expand/collapse — no navigation
  }

  const handleSubItemClick = (page: string) => {
    onNavigate?.(page)
  }

  return (
    <>
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              size="lg" 
              asChild
              onClick={() => onNavigate?.("home")}
            >
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Calendar className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">FCalendar</span>
                  <span className="truncate text-xs">Your Schedule</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* Search field */}
        <div className="relative mt-1 sidebar-search-wrapper">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="sidebar-search h-8 w-full rounded-md border border-input bg-background pl-8 pr-7 text-sm shadow-none outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={filteredNavMain}
          onItemClick={handleNavClick}
          onSubItemClick={handleSubItemClick}
          searchQuery={searchQuery}
          openItem={openNavItem}
          onOpenItemChange={handleNavItemChange}
        />
        <NavProjects
          settingsItems={data.settingsItems}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={handleSettingsOpenChange}
          currentPage={currentPage}
          onNavigate={onNavigate}
          isEditMode={isEditMode}
          onEditModeToggle={handleEditModeToggle}
          searchQuery={searchQuery}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>

      {/* Unsaved Changes Dialog */}
      <Dialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. What would you like to do before turning off Edit Mode?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                discardChanges()
                setUnsavedDialogOpen(false)
                setIsEditMode(false)
              }}
            >
              Discard Changes
            </Button>
            <Button
              onClick={async () => {
                await saveChanges()
                setUnsavedDialogOpen(false)
                setIsEditMode(false)
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save & Turn Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
