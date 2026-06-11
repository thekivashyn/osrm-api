export function fmtDist(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function fmtDur(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}g ${rm}p` : `${h} giờ`;
}

export const PROFILE_LABELS: Record<string, string> = {
  driving: "Ô tô",
  motorbike: "Xe máy",
};

export const DEFAULT_FROM = {
  lat: 10.7635,
  lng: 106.644,
  name: "230/25 Lạc Long Quân, Bình Thới, HCM",
};

export const DEFAULT_TO = {
  lat: 10.795112,
  lng: 106.731227,
  name: "Trần Não, An Khánh, HCM",
};

export const DURATION_DISCLAIMER = "Giả định không kẹt xe";
