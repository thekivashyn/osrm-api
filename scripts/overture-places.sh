#!/bin/sh
# Overture Places (Meta/Microsoft POI data) → Pelias CSV import — **server only**.
#
# Vietnamese businesses self-report alley addresses on Facebook ("180/30 Hẻm 180
# Đường Lạc Long Quân") which Meta contributes to Overture. OSM lacks most of
# these house numbers, so each place becomes TWO Pelias docs:
#   - venue:   searchable by shop name
#   - address: housenumber/street parsed from the freeform address → exact pins
#              for "số nhà trong hẻm" queries that interpolation can't answer.
#
# Idempotent: Overture GERS ids + content-hash ids → re-import upserts in place.
# Monthly refresh via geo-refresh.sh picks up the latest Overture release.
set -e

if [ "$(uname -s)" = "Darwin" ] && [ "${OVERTURE_ALLOW_LOCAL:-}" != "1" ]; then
  echo "Overture import chạy trên server (cần Pelias ES). SSH server → bun run pelias:overture"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PELIAS="$ROOT/.pelias-docker/pelias"
OUT_DIR="$ROOT/data/custom-addresses"
S3_BASE="s3://overturemaps-us-west-2/release"

mkdir -p "$OUT_DIR"

if ! command -v duckdb >/dev/null 2>&1; then
  echo "==> Installing DuckDB CLI"
  curl -fsSL https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip -o /tmp/duckdb.zip
  unzip -o /tmp/duckdb.zip -d /usr/local/bin
  chmod +x /usr/local/bin/duckdb
fi

# Latest monthly release unless pinned via OVERTURE_RELEASE.
RELEASE="${OVERTURE_RELEASE:-$(
  curl -fsS 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/&delimiter=/' |
    grep -o 'release/2[0-9-]*\.[0-9]*' | sed 's|release/||' | sort | tail -1
)}"
if [ -z "$RELEASE" ]; then
  echo "Cannot discover Overture release (S3 listing failed)." >&2
  exit 1
fi
echo "==> Overture release: $RELEASE"

SQL_FILE="$(mktemp /tmp/overture-XXXX.sql)"
cat > "$SQL_FILE" <<EOF
INSTALL httpfs; LOAD httpfs;
CREATE OR REPLACE SECRET ov (TYPE s3, PROVIDER config, REGION 'us-west-2');
SET memory_limit='3GB';
SET threads=2;
SET preserve_insertion_order=false;

CREATE TEMP TABLE vn AS
SELECT id,
       trim(names.primary) AS name,
       round(bbox.xmin, 6) AS lon,
       round(bbox.ymin, 6) AS lat,
       categories.primary AS category,
       trim(addresses[1].freeform) AS addr,
       addresses[1].locality AS locality
FROM read_parquet('$S3_BASE/$RELEASE/theme=places/type=place/*', hive_partitioning=1)
WHERE bbox.xmin BETWEEN 102.14 AND 109.47
  AND bbox.ymin BETWEEN 8.18 AND 23.39
  AND confidence >= 0.5
  AND (addresses[1].country = 'VN' OR addresses IS NULL)
  AND coalesce(operating_status, '') <> 'closed'
  AND names.primary IS NOT NULL
  AND length(trim(names.primary)) BETWEEN 2 AND 120;

COPY (
  SELECT id,
         'overture' AS source,
         'venue' AS layer,
         name, lat, lon,
         to_json(struct_pack(category := category, address := addr, locality := locality)) AS addendum_json_overture
  FROM vn
) TO '/tmp/overture-venues-vn.csv' (HEADER, DELIMITER ',');

COPY (
  WITH heads AS (
    SELECT trim(split_part(addr, ',', 1)) AS head, lat, lon
    FROM vn
    WHERE addr IS NOT NULL
  ), parsed AS (
    SELECT regexp_extract(head, '^(?:số\s+)?(\d+[A-Za-z]?(?:/\d+[A-Za-z]?)*)\s+(\D.{2,80})\$', 1, 'i') AS housenumber,
           trim(regexp_extract(head, '^(?:số\s+)?(\d+[A-Za-z]?(?:/\d+[A-Za-z]?)*)\s+(\D.{2,80})\$', 2, 'i')) AS street,
           lat, lon
    FROM heads
  )
  SELECT md5(concat(housenumber, '|', lower(street), '|', round(lat, 4), '|', round(lon, 4))) AS id,
         'overture' AS source,
         'address' AS layer,
         concat(housenumber, ' ', street) AS name,
         housenumber, street, lat, lon
  FROM parsed
  WHERE housenumber <> '' AND street <> ''
  QUALIFY row_number() OVER (
    PARTITION BY housenumber, lower(street), round(lat, 4), round(lon, 4)
    ORDER BY housenumber
  ) = 1
) TO '/tmp/overture-addresses-vn.csv' (HEADER, DELIMITER ',');
EOF

echo "==> Extracting Vietnam places from Overture (bbox + confidence>=0.5)"
duckdb < "$SQL_FILE"
rm -f "$SQL_FILE"

mv /tmp/overture-venues-vn.csv "$OUT_DIR/overture-venues-vn.csv"
mv /tmp/overture-addresses-vn.csv "$OUT_DIR/overture-addresses-vn.csv"
echo "==> CSV ready:"
wc -l "$OUT_DIR"/overture-*.csv

if [ ! -x "$PELIAS" ]; then
  echo "Pelias CLI not found ($PELIAS) — CSVs generated, import skipped."
  exit 0
fi

echo "==> Pelias import csv"
if [ "$(id -u)" = "0" ]; then
  su - pelias -c "cd '$ROOT/pelias/vietnam' && '$PELIAS' import csv"
else
  (cd "$ROOT/pelias/vietnam" && "$PELIAS" import csv)
fi

echo "==> Optimize + reload API"
curl -s -XPOST "http://127.0.0.1:9200/pelias/_refresh" >/dev/null || true
curl -m 900 -s -XPOST "http://127.0.0.1:9200/pelias/_forcemerge?max_num_segments=1" >/dev/null || true
docker restart pelias_api >/dev/null 2>&1 || true

echo "==> [$(date -Is)] Overture import done"
echo "Test: curl 'http://127.0.0.1:4000/v1/search?text=180/30+L%E1%BA%A1c+Long+Qu%C3%A2n&size=3'"
