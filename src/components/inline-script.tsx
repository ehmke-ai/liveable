// Runs synchronously as the browser parses the HTML (before hydration), so it can correct
// DOM the server rendered with a default before the first paint. `type` flips to
// "text/plain" on the client so React doesn't try to treat it as a script tag to manage.
// See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
