/**
 * Captures the Where you stand results and downloads them as a PNG or a US Letter PDF.
 * The capture is an off-screen copy of the results, with the caption and full school list shown.
 */

const SCALE = 2
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 36

type CardBox = { top: number; bottom: number }
type Slice = { top: number; height: number }

/** Cuts `height` into page-sized slices, breaking at a card top when the card would be split. */
export function pageSlices(height: number, page: number, cards: CardBox[]): Slice[] {
  const slices: Slice[] = []
  let y = 0
  while (y < height - 0.5) {
    let end = Math.min(y + page, height)
    const next = cards.find((card) => card.top > y + 8 && card.top < end - 8 && card.bottom > end + 0.5)
    if (next) end = next.top
    if (end <= y + 0.5) end = Math.min(y + page, height)
    slices.push({ top: y, height: end - y })
    y = end
  }
  return slices
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function waitForLayout() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** An off-screen copy, so revealing the caption and the full school list does not move the page. */
function mountClone(root: HTMLElement) {
  const host = document.createElement("div")
  const width = root.getBoundingClientRect().width
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;`
  const clone = root.cloneNode(true) as HTMLElement
  host.appendChild(clone)
  document.body.appendChild(host)
  prepareClone(clone)
  return { clone, remove: () => host.remove(), fonts: document.fonts }
}

/**
 * A copy in a frame that does not carry the page's `.dark` class. PDF export always uses
 * this, so the file stays on the light palette while the page can stay dark.
 */
function mountLightFrame(root: HTMLElement) {
  const width = root.getBoundingClientRect().width
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:200px;border:0;`
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    throw new Error("The export frame did not open.")
  }
  doc.open()
  doc.write("<!DOCTYPE html><html><head></head><body style=\"margin:0\"></body></html>")
  doc.close()
  doc.documentElement.className = document.documentElement.className.replace(/\bdark\b/g, "").trim()
  doc.documentElement.style.colorScheme = "light"
  doc.body.className = document.body.className
  copyDocumentStyles(doc)
  const host = doc.createElement("div")
  host.style.width = `${width}px`
  host.style.background = "#ffffff"
  const clone = doc.importNode(root, true) as HTMLElement
  host.appendChild(clone)
  doc.body.appendChild(host)
  prepareClone(clone)
  iframe.style.height = `${doc.body.scrollHeight}px`
  return { clone, remove: () => iframe.remove(), fonts: doc.fonts }
}

function copyDocumentStyles(doc: Document) {
  const chunks: string[] = []
  for (const sheet of document.styleSheets) {
    try {
      chunks.push([...sheet.cssRules].map((rule) => rule.cssText).join("\n"))
    } catch {
      const node = sheet.ownerNode
      if (node) doc.head.appendChild(node.cloneNode(true))
    }
  }
  const style = doc.createElement("style")
  style.textContent = chunks.join("\n")
  doc.head.appendChild(style)
}

function prepareClone(clone: HTMLElement) {
  for (const node of clone.querySelectorAll<HTMLElement>("[data-export-only]")) node.hidden = false
  for (const node of clone.querySelectorAll<HTMLElement>("[data-export-expand]")) {
    node.classList.remove("max-h-96", "overflow-y-auto")
  }
  for (const node of clone.querySelectorAll<HTMLElement>("[data-capture=exclude]")) node.hidden = true
}

export async function downloadResults(root: HTMLElement, fileBase: string, format: "png" | "pdf") {
  const mounted = format === "pdf" ? mountLightFrame(root) : mountClone(root)
  const { clone, remove } = mounted
  try {
    await (mounted.fonts ?? document.fonts).ready
    await waitForLayout()
    const rootRect = clone.getBoundingClientRect()
    const cards = [...clone.querySelectorAll<HTMLElement>("[data-export-card]")].map((node) => {
      const rect = node.getBoundingClientRect()
      return { top: rect.top - rootRect.top, bottom: rect.bottom - rootRect.top }
    })
    const { snapdom } = await import("@zumer/snapdom")
    const captured = await snapdom(clone, {
      scale: SCALE,
      dpr: 1,
      backgroundColor: format === "pdf" ? "#ffffff" : getComputedStyle(document.body).backgroundColor,
      embedFonts: true,
      exclude: ["[data-capture=exclude]"],
      excludeMode: "remove",
    })
    if (format === "png") {
      saveBlob(await captured.toBlob({ format: "png" }), `${fileBase}.png`)
      return
    }

    const meta = captured.meta
    const scaleY = rootRect.height > 0 ? meta.h0 / rootRect.height : 1
    const pageCss = ((PAGE_HEIGHT - MARGIN * 2) * rootRect.width) / (PAGE_WIDTH - MARGIN * 2)
    const slices = pageSlices(rootRect.height, pageCss, cards)
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ unit: "pt", format: "letter" })
    for (let index = 0; index < slices.length; index++) {
      const slice = slices[index]
      const canvas = await captured.toCanvas({
        crop: {
          x: meta.contentX,
          y: meta.contentY + slice.top * scaleY,
          width: meta.w0,
          height: Math.max(1, slice.height * scaleY),
        },
      })
      if (index > 0) pdf.addPage()
      const width = PAGE_WIDTH - MARGIN * 2
      const height = width * (canvas.height / canvas.width)
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, width, height)
    }
    pdf.save(`${fileBase}.pdf`)
  } finally {
    remove()
  }
}
