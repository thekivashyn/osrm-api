/** Strip host/IP from probe messages before returning to clients. */
export function sanitizeProbeMessage(message?: string): string | undefined {
  if (!message) return message;
  return message
    .replace(/https?:\/\/[^\s]+/g, "[backend]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, "[backend]");
}

export function publicProbeResult(
  service: string,
  probe: { status: string; url?: string; message?: string },
) {
  return {
    status: probe.status,
    service,
    message: sanitizeProbeMessage(probe.message),
  };
}
