#!/bin/sh
# Track OSRM + Pelias readiness on the server.
set -e

WATCH="${1:-}"

print_once() {
  echo "══════════════════════════════════════════"
  echo " Routing stack status — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "══════════════════════════════════════════"

  echo ""
  echo "▶ OSRM (routing :5050 / :5051)"
  if docker ps --format '{{.Names}}' | grep -qx osrm; then
    echo "  container: $(docker ps --filter name=osrm --format '{{.Status}}')"
  else
    echo "  container: not running"
  fi
  if curl -sf "http://127.0.0.1:5050/route/v1/driving/106.66,10.76;106.70,10.77?overview=false" 2>/dev/null | grep -q '"code":"Ok"'; then
    echo "  car (:5050): READY"
  else
    echo "  car (:5050): down or rebuilding"
  fi

  if [ -f /opt/routing-api/data/vietnam-car.osrm ]; then
    echo "  car graph file: $(du -h /opt/routing-api/data/vietnam-car.osrm | cut -f1)"
  fi
  if [ -f /opt/routing-api/data/vietnam-motor.osrm ]; then
    echo "  motor graph file: $(du -h /opt/routing-api/data/vietnam-motor.osrm | cut -f1)"
  fi

  echo ""
  echo "▶ Pelias (geocode :4000)"
  if docker ps --format '{{.Names}}' | grep -qx pelias_api; then
    echo "  api: $(docker ps --filter name=pelias_api --format '{{.Status}}')"
  else
    echo "  api: not running"
  fi
  if docker ps --format '{{.Names}}' | grep -qx pelias_elasticsearch; then
    echo "  elasticsearch: $(docker ps --filter name=pelias_elasticsearch --format '{{.Status}}')"
  fi

  PELIAS_STATUS=$(curl -s "http://127.0.0.1:4000/v1/autocomplete?text=Bitexco&size=1" 2>/dev/null || echo "")
  if [ -n "$PELIAS_STATUS" ] && echo "$PELIAS_STATUS" | grep -q '"label"'; then
    echo "  geocode (:4000): READY"
    DOC_COUNT=$(curl -s "http://127.0.0.1:9200/pelias/_count" 2>/dev/null | grep -o '"count":[0-9]*' | cut -d: -f2)
    [ -n "$DOC_COUNT" ] && echo "  index docs: $DOC_COUNT"
  else
    echo "  geocode (:4000): down or importing…"
  fi

  if docker ps --format '{{.Names}}' | grep -qx pelias_api; then
    docker logs pelias_api 2>&1 | tail -2 | sed 's/^/    /'
  fi

  echo ""
  echo "▶ Routing API (:8080)"
  if systemctl is-active --quiet routing-api 2>/dev/null; then
    echo "  systemd: active"
  else
    echo "  systemd: inactive"
  fi
  curl -sf http://127.0.0.1:8080/health 2>/dev/null | head -c 120 && echo "" || echo "  health: no response"

  echo ""
  echo "▶ Buildings (local index)"
  MANIFEST="${ROOT:-.}/data/buildings/manifest.json"
  if [ -f "$MANIFEST" ]; then
    echo "  index: READY ($(du -sh "${ROOT:-.}/data/buildings" 2>/dev/null | cut -f1))"
    grep -E '"featureCount"|"tileCount"' "$MANIFEST" 2>/dev/null | sed 's/^/  /'
  else
    echo "  index: missing — run: bun run buildings:extract"
  fi

  echo ""
  echo "Tips:"
  echo "   • Building index: bun run buildings:extract"
  echo "   • Import Pelias:  bun run pelias:import"
  echo "   • Start Pelias:   bun run pelias:up"
  echo "   • OSRM logs:      bun run osrm:logs"
  echo "   • Pelias logs:    bun run pelias:logs"
}

if [ "$WATCH" = "--watch" ]; then
  while true; do
    clear
    print_once
    sleep 30
  done
else
  print_once
fi
