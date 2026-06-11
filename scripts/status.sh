#!/bin/sh
# Track OSRM + Nominatim readiness on the server.
# Usage:
#   ./scripts/status.sh          # one-shot
#   ./scripts/status.sh --watch  # refresh every 30s

WATCH=false
[ "$1" = "--watch" ] || [ "$1" = "-w" ] && WATCH=true

check() {
  echo "══════════════════════════════════════════"
  echo " Routing stack status — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "══════════════════════════════════════════"

  # --- OSRM ---
  echo ""
  echo "▶ OSRM (routing)"
  if docker ps --format '{{.Names}}' | grep -qx osrm; then
    echo "  container: $(docker ps --filter name=osrm --format '{{.Status}}')"
  else
    echo "  container: NOT RUNNING"
  fi

  CAR_OK=false
  MOTOR_OK=false
  if curl -sf "http://127.0.0.1:5050/route/v1/driving/106.66,10.76;106.70,10.77?overview=false" >/dev/null 2>&1; then
    CAR_OK=true
    echo "  car   (:5050): READY"
  else
    echo "  car   (:5050): building…"
  fi
  if curl -sf "http://127.0.0.1:5051/route/v1/driving/106.66,10.76;106.70,10.77?overview=false" >/dev/null 2>&1; then
    MOTOR_OK=true
    echo "  motor (:5051): READY"
  else
    echo "  motor (:5051): building…"
  fi

  if [ -f /opt/routing-api/data/vietnam-car.osrm ]; then
    echo "  car graph file: $(du -h /opt/routing-api/data/vietnam-car.osrm | cut -f1)"
  fi
  if [ -f /opt/routing-api/data/vietnam-motor.osrm ]; then
    echo "  motor graph file: $(du -h /opt/routing-api/data/vietnam-motor.osrm | cut -f1)"
  fi

  echo "  last log:"
  docker logs osrm 2>&1 | tail -2 | sed 's/^/    /'

  # --- Nominatim ---
  echo ""
  echo "▶ Nominatim (geocode / GEO)"
  if docker ps --format '{{.Names}}' | grep -qx nominatim; then
    echo "  container: $(docker ps --filter name=nominatim --format '{{.Status}}')"
  else
    echo "  container: NOT RUNNING"
  fi

  GEO_STATUS=$(curl -s http://127.0.0.1:9091/status 2>/dev/null || echo "")
  if echo "$GEO_STATUS" | grep -q OK; then
    echo "  geocode (:9091): READY"
  else
    echo "  geocode (:9091): importing… (${GEO_STATUS:-no response})"
  fi
  echo "  last log:"
  docker logs nominatim 2>&1 | tail -2 | sed 's/^/    /'

  # --- API ---
  echo ""
  echo "▶ Routing API"
  if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "  api (:8080): READY"
  else
    echo "  api (:8080): DOWN"
  fi

  # --- Summary ---
  echo ""
  echo "──────────────────────────────────────────"
  if $CAR_OK && $MOTOR_OK && echo "$GEO_STATUS" | grep -q OK; then
    echo " ALL READY — playground routing + geocode should work."
    echo " Run: ./scripts/secure-docker-ports.sh"
  else
    echo " STILL BUILDING — HTTP 502 on /api/route is normal until OSRM ready."
    [ "$CAR_OK" = false ] && echo "   • Wait OSRM: docker logs -f osrm"
    [ "$GEO_STATUS" = "" ] || ! echo "$GEO_STATUS" | grep -q OK && echo "   • Wait GEO:  docker logs -f nominatim"
  fi
  echo "──────────────────────────────────────────"
}

if $WATCH; then
  while true; do
    clear
    check
    sleep 30
  done
else
  check
fi
