#!/bin/sh
# Download latest Vietnam OSM extract and mark graph for rebuild.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${ROOT}/data"
PBF_URL="${PBF_URL:-https://download.geofabrik.de/asia/vietnam-latest.osm.pbf}"
PBF_FILE="${DATA_DIR}/vietnam-latest.osm.pbf"

mkdir -p "${DATA_DIR}"

echo "Downloading latest Vietnam OSM from Geofabrik..."
curl -fsSL "${PBF_URL}" -o "${PBF_FILE}.tmp"
mv "${PBF_FILE}.tmp" "${PBF_FILE}"
ls -lh "${PBF_FILE}"

echo "Removing processed OSRM files (extract/partition/customize will run on next start)..."
rm -f "${DATA_DIR}"/vietnam-latest.osrm*
touch "${DATA_DIR}/.osrm-rebuild"

echo "Removing building index (rebuild after map update)..."
rm -rf "${DATA_DIR}/buildings"

echo "Done. Restart OSRM to rebuild graph:"
echo "  bun run osrm:rebuild"
echo "Then rebuild building footprints:"
echo "  bun run buildings:extract"
