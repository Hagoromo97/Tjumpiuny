import { useState } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"

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

export function NavMain({
  items,
  onItemClick,
  onSubItemClick,
  searchQuery = "",
  openItem: controlledOpenItem,
  onOpenItemChange,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    page?: string
    isActive?: boolean
    items?: {
      title: string
      url: string
      page?: string
    }[]
  }[]
  onItemClick?: (title: string) => void
  onSubItemClick?: (page: string) => void
  searchQuery?: string
  openItem?: string | null
  onOpenItemChange?: (item: string | null) => void
}) {
  const initialOpen = items.find((i) => i.isActive && i.items?.length)?.title ?? null
  const [localOpenItem, setLocalOpenItem] = useState<string | null>(initialOpen)

  const isControlled = controlledOpenItem !== undefined
  const openItem = isControlled ? controlledOpenItem : localOpenItem
  const setOpenItem = (val: string | null) => {
    if (isControlled) onOpenItemChange?.(val)
    else setLocalOpenItem(val)
  }

  // Auto-expand all groups when searching
  const isSearching = searchQuery.trim().length > 0

  const handleToggle = (title: string, hasChildren: boolean, page?: string) => {
    if (!hasChildren) {
      if (page) onSubItemClick?.(page)
      else onItemClick?.(title)
      return
    }
    setOpenItem(openItem === title ? null : title)
    onItemClick?.(title)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {isSearching && items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 px-3 text-center animate-in fade-in duration-200">
            <span className="text-xl">🔍</span>
            <p className="text-xs font-medium text-muted-foreground">No results found</p>
            <p className="text-[11px] text-muted-foreground/60">Try a different keyword</p>
          </div>
        ) : (
        items.map((item) => {
          const hasChildren = !!item.items?.length
          const isOpen = isSearching ? true : openItem === item.title

          return (
            <Collapsible
              key={item.title}
              asChild
              open={hasChildren ? isOpen : undefined}
              onOpenChange={hasChildren ? (open) => { if (!isSearching) setOpenItem(open ? item.title : null) } : undefined}
            >
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.title} className="transition-colors duration-150">
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault()
                      handleToggle(item.title, hasChildren, item.page)
                    }}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
                {hasChildren ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction
                        className="transition-transform duration-300 data-[state=open]:rotate-90"
                      >
                        <ChevronRight />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="nav-collapsible-content">
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild className="transition-colors duration-150">
                              <a
                                href={subItem.url}
                                onClick={(e) => {
                                  e.preventDefault()
                                  if (subItem.page) onSubItemClick?.(subItem.page)
                                }}
                              >
                                <span>{subItem.title}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        })
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}

