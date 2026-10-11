import type { Metadata } from "next"
import { Crimson_Pro, Crimson_Text, Geist_Mono, Open_Sans } from "next/font/google"

import { AppSidebar } from "@/components/app-sidebar"
import { InlineScript } from "@/components/inline-script"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Serif headings + wordmark, matching the Ceptly design system.
const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
})

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: {
    default: "basedmetrics.com — America by the numbers",
    template: "%s — basedmetrics.com",
  },
  description:
    "US demographics by state and county: non-Hispanic White share over time, religion, 2024 election results, immigration enforcement, and family formation, with Europe for comparison.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${geistMono.variable} ${crimsonText.variable} ${crimsonPro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={`(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
                <SidebarTrigger />
                <PageBreadcrumb />
                <div className="ml-auto">
                  <ThemeToggle />
                </div>
              </header>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
