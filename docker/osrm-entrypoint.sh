#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
PBF_FILE="${DATA_DIR}/vietnam-latest.osm.pbf"
CAR_BASE="${DATA_DIR}/vietnam-car"
MOTOR_BASE="${DATA_DIR}/vietnam-motor"
LEGACY_BASE="${DATA_DIR}/vietnam-latest"
REBUILD_FLAG="${DATA_DIR}/.osrm-rebuild"

if [ ! -f "${PBF_FILE}" ]; then
  echo "ERROR: Missing ${PBF_FILE}"
  echo "Run on host first: bun run osrm:prepare"
  exit 1
fi

needs_rebuild() {
  if [ -f "${REBUILD_FLAG}" ]; then
    return 0
  fi
  if [ ! -f "${CAR_BASE}.osrm" ]; then
    return 0
  fi
  if [ ! -f "${MOTOR_BASE}.osrm" ]; then
    return 0
  fi
  return 1
}

prepare_graph() {
  base="$1"
  profile="$2"
  label="$3"
  pbf_link="${base}.osm.pbf"

  if [ ! -f "${base}.osrm" ]; then
    echo "Extracting ${label} graph..."
    ln -sf "${PBF_FILE}" "${pbf_link}"
    osrm-extract -p "${profile}" "${pbf_link}"
    rm -f "${pbf_link}"
  fi

  if [ ! -f "${base}.osrm.partition" ]; then
    echo "Running osrm-partition (${label})..."
    osrm-partition "${base}.osrm"
  fi

  if [ ! -f "${base}.osrm.cell_metrics" ]; then
    echo "Running osrm-customize (${label})..."
    osrm-customize "${base}.osrm"
  fi
}

if needs_rebuild; then
  echo "Rebuilding OSRM graphs (car + motorbike profiles)..."
  rm -f "${CAR_BASE}.osrm"* "${MOTOR_BASE}.osrm"* "${LEGACY_BASE}.osrm"*
  rm -f "${REBUILD_FLAG}"
fi

prepare_graph "${CAR_BASE}" "/profiles/car-vietnam.lua" "car"
prepare_graph "${MOTOR_BASE}" "/profiles/motorbike-vietnam.lua" "motorbike"

OSRM_THREADS="${OSRM_THREADS:-2}"

echo "OSRM car ready on port 5000, motorbike on port 5001 (container)."
echo "osrm-routed: algorithm=mld mmap=on threads=${OSRM_THREADS}"

osrm-routed --algorithm mld --mmap -t "${OSRM_THREADS}" -p 5000 "${CAR_BASE}.osrm" &
CAR_PID=$!
osrm-routed --algorithm mld --mmap -t "${OSRM_THREADS}" -p 5001 "${MOTOR_BASE}.osrm" &
MOTOR_PID=$!

trap 'kill "$CAR_PID" "$MOTOR_PID" 2>/dev/null; wait' INT TERM

wait "$CAR_PID" "$MOTOR_PID"
