/** True when request hits API directly (e.g. curl 127.0.0.1:8080), not via nginx/Vite/CF proxy. */
export function isDirectLocalApiAccess(request: Request): boolean {
  if (request.headers.get("cf-connecting-ip")) return false;
  if (request.headers.get("x-real-ip")) return false;
  if (request.headers.get("x-forwarded-for")) return false;
  return true;
}
