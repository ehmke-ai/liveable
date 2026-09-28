"use client"

import { usePathname } from "next/navigation"
import { Fragment } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getCountryBySlug } from "@/lib/demographics"
import { getStateBySlug } from "@/lib/states"
import { topics } from "@/lib/topics"

type Crumb = { label: string; href?: string }

function crumbsForPathname(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return [{ label: "Explore by topic" }]

  const [section, slug] = segments

  if (section === "topics" && slug) {
    const topic = topics.find((t) => t.slug === slug)
    return [
      { label: "Topics", href: "/" },
      { label: topic ? topic.label : slug },
    ]
  }

  if (section === "state" && slug) {
    const state = getStateBySlug(slug)
    return [{ label: "US states" }, { label: state ? state.state : slug }]
  }

  if (segments.length === 1) {
    const country = getCountryBySlug(section)
    if (country) return [{ label: country.country }]
  }

  return [{ label: pathname }]
}

export function PageBreadcrumb() {
  const pathname = usePathname()
  const crumbs = crumbsForPathname(pathname)

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap overflow-hidden">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="truncate">
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
