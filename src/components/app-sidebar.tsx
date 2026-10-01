"use client"

import { Globe2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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
import { demographicsData, slugify } from "@/lib/demographics"
import { stateNav } from "@/lib/states"
import { topicHref, topics } from "@/lib/topics"

const sortedCountries = [...demographicsData].sort((a, b) =>
  a.country.localeCompare(b.country)
)

export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // The mobile sidebar is a drawer; close it once a link is chosen.
  function closeOnMobile() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/"
          onClick={closeOnMobile}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
        >
          <Globe2 className="size-4 shrink-0" />
          <span className="truncate font-brand text-lg">basedmetrics.com</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Topics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {topics.map((t) => {
                const href = topicHref(t.slug)
                return (
                  <SidebarMenuItem key={t.slug}>
                    <SidebarMenuButton asChild isActive={pathname === href} tooltip={t.label}>
                      <Link href={href} onClick={closeOnMobile}>
                        <t.icon />
                        <span>{t.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Countries</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sortedCountries.map((d) => {
                const href = `/${slugify(d.country)}`
                return (
                  <SidebarMenuItem key={d.country}>
                    <SidebarMenuButton asChild isActive={pathname === href} tooltip={d.country}>
                      <Link href={href} onClick={closeOnMobile}>
                        <span>{d.country}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>US states</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {stateNav.map((s) => {
                const href = `/united-states/${s.slug}`
                return (
                  <SidebarMenuItem key={s.slug}>
                    <SidebarMenuButton asChild isActive={pathname === href} tooltip={s.state}>
                      <Link href={href} onClick={closeOnMobile}>
                        <span>{s.state}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
