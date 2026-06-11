#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${ROOT}/data"
PBF_URL="${PBF_URL:-https://download.geofabrik.de/asia/vietnam-latest.osm.pbf}"
PBF_FILE="${DATA_DIR}/vietnam-latest.osm.pbf"

mkdir -p "${DATA_DIR}"

if [ -f "${PBF_FILE}" ]; then
  echo "Already exists: ${PBF_FILE}"
  ls -lh "${PBF_FILE}"
  exit 0
fi

echo "Downloading Vietnam OSM (~300MB, may take a few minutes)..."
curl -fsSL "${PBF_URL}" -o "${PBF_FILE}"
echo "Done: ${PBF_FILE}"
ls -lh "${PBF_FILE}"
