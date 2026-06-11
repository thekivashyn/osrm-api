import L from "leaflet";

export type PinField = "from" | "to";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** First segment of a geocode label, trimmed for map callout. */
export function pinLabelShort(text: string, max = 40): string {
  const head = text.split(",")[0]?.trim() || text.trim();
  if (head.length <= max) return head;
  return `${head.slice(0, max - 1)}…`;
}

export function labeledPinIcon(field: PinField, label?: string | null) {
  const trimmed = label?.trim();
  if (!trimmed) {
    return L.divIcon({
      className: "",
      html: `<div class="placed-pin placed-pin-${field}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  const short = escapeHtml(pinLabelShort(trimmed));
  return L.divIcon({
    className: "",
    html: `<div class="labeled-pin labeled-pin-${field}"><div class="labeled-pin-label">${short}</div><div class="placed-pin placed-pin-${field}"></div></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
