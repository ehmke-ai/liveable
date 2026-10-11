"use client"

import {
  BarChart3,
  ChevronRight,
  Flag,
  Globe2,
  Table2,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Collapsible } from "radix-ui"

import { PlaceSearch } from "@/components/place-search"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { countryHref, demographicsData } from "@/lib/demographics"
import { stateNav } from "@/lib/states"
import { EUROPE_HOME_TOPIC, europeTopicHref, europeTopics } from "@/lib/topics"

const sortedCountries = demographicsData
  .filter((d) => d.country !== "United States")
  .sort((a, b) => a.country.localeCompare(b.country))

type NavLink = {
  href: string
  label: string
  icon?: LucideIcon
  /** Also active on pages below href (a state's counties) */
  nested?: boolean
}

const usLinks: NavLink[] = [
  { href: "/", label: "United States", icon: Flag },
  { href: "/states", label: "All states", icon: Table2 },
]

const europeLinks: NavLink[] = [
  { href: "/europe", label: "Europe overview", icon: Globe2 },
  ...europeTopics
    .filter((t) => t.slug !== EUROPE_HOME_TOPIC)
    .map((t) => ({ href: europeTopicHref(t.slug), label: t.label, icon: t.icon })),
  ...sortedCountries.map((d) => ({ href: countryHref(d.country), label: d.country })),
]

const stateLinks: NavLink[] = stateNav.map((s) => ({
  href: `/united-states/${s.slug}`,
  label: s.state,
  nested: true,
}))

export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // The mobile sidebar is a drawer; close it once a link is chosen.
  function closeOnMobile() {
    if (isMobile) setOpenMobile(false)
  }

  function links(items: NavLink[]) {
    return (
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={
                pathname === item.href || (!!item.nested && pathname.startsWith(`${item.href}/`))
              }
              tooltip={item.label}
            >
              <Link href={item.href} onClick={closeOnMobile}>
                {item.icon && <item.icon />}
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    )
  }

  // Long lists collapse, opening by default when the current page is inside them. The key
  // remounts the group on entering or leaving its section so the default applies again.
  function collapsibleGroup(label: string, icon: LucideIcon, items: NavLink[], open: boolean) {
    const Icon = icon
    return (
      <Collapsible.Root key={`${label}-${open}`} defaultOpen={open} className="group/collapsible">
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <Collapsible.Trigger className="w-full gap-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Icon />
              {label}
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </Collapsible.Trigger>
          </SidebarGroupLabel>
          <Collapsible.Content>
            <SidebarGroupContent>{links(items)}</SidebarGroupContent>
          </Collapsible.Content>
        </SidebarGroup>
      </Collapsible.Root>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/"
          onClick={closeOnMobile}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
        >
          <Flag className="size-4 shrink-0" />
          <span className="truncate font-brand text-lg">basedmetrics.com</span>
        </Link>
        <PlaceSearch onNavigate={closeOnMobile} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>{links(usLinks)}</SidebarGroupContent>
        </SidebarGroup>
        {collapsibleGroup(
          "States",
          BarChart3,
          stateLinks,
          pathname.startsWith("/united-states/")
        )}
        {collapsibleGroup(
          "Compare: Europe",
          Globe2,
          europeLinks,
          pathname === "/europe" || pathname.startsWith("/europe/")
        )}
      </SidebarContent>
    </Sidebar>
  )
}
