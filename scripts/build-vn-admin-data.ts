/**
 * Build src/data/vn-admin-2025.json from the MIT-licensed
 * tranngocminhhieu/vietnamadminunits dataset (GSO + sapnhap.bando.com.vn).
 *
 * Vietnam's July 2025 reorganization merged 63 provinces → 34 and
 * 10,602 wards → 3,321 (districts abolished). OSM/WOF still carry the
 * legacy hierarchy, so the geocoder needs a name-mapping table to rewrite
 * queries between eras. Names only — no coordinates are vendored.
 *
 * Run once (output is committed): bun run scripts/build-vn-admin-data.ts
 */

const COMMIT = "7fac8c45805aad9916b17237c54baf4502303b93";
const BASE = `https://raw.githubusercontent.com/tranngocminhhieu/vietnamadminunits/${COMMIT}`;
const CONVERT_CSV = `${BASE}/data/interim/convert_legacy_2025_simple.csv`;

/** Minimal RFC-4180 CSV parser (handles quoted fields). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

const res = await fetch(CONVERT_CSV);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const rows = parseCsv(await res.text());
const header = rows.shift()!;
const col = (name: string) => {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`Missing column ${name}`);
  return i;
};

const iProvince = col("province");
const iDistrict = col("district");
const iWard = col("ward");
const iNewProvince = col("newProvince");
const iNewWard = col("newWard");
const iNewWardLat = col("newWardLat");
const iNewWardLon = col("newWardLon");

// String pools keep the vendored JSON compact (province/district names repeat).
const pool = (() => {
  const list: string[] = [];
  const idx = new Map<string, number>();
  return {
    id(s: string): number {
      let i = idx.get(s);
      if (i === undefined) {
        i = list.length;
        idx.set(s, i);
        list.push(s);
      }
      return i;
    },
    list,
  };
})();

// newProvince|newWard -> legacy [province, district, ward][]
const currentWards = new Map<
  string,
  { p: number; w: string; lat: number; lon: number; legacy: [number, number, string][] }
>();
const provincePairs = new Map<string, string>(); // legacy province -> new province

for (const r of rows) {
  const province = r[iProvince]?.trim();
  const district = r[iDistrict]?.trim();
  const ward = r[iWard]?.trim();
  const newProvince = r[iNewProvince]?.trim();
  const newWard = r[iNewWard]?.trim();
  if (!province || !newProvince || !newWard) continue;

  provincePairs.set(province, newProvince);

  const key = `${newProvince}|${newWard}`;
  let entry = currentWards.get(key);
  if (!entry) {
    entry = {
      p: pool.id(newProvince),
      w: newWard,
      lat: Number(r[iNewWardLat]) || 0,
      lon: Number(r[iNewWardLon]) || 0,
      legacy: [],
    };
    currentWards.set(key, entry);
  }
  if (ward) {
    entry.legacy.push([pool.id(province), pool.id(district ?? ""), ward]);
  }
}

const out = {
  source: `tranngocminhhieu/vietnamadminunits@${COMMIT.slice(0, 7)} (MIT)`,
  names: pool.list,
  provinces: [...provincePairs.entries()].map(([legacy, current]) => ({ legacy, current })),
  wards: [...currentWards.values()],
};

const outPath = new URL("../src/data/vn-admin-2025.json", import.meta.url).pathname;
await Bun.write(outPath, JSON.stringify(out));

const changed = out.provinces.filter((p) => p.legacy !== p.current).length;
console.log(
  `Wrote ${outPath}: ${out.provinces.length} legacy provinces (${changed} renamed), ` +
    `${out.wards.length} current wards, ${rows.length} legacy ward mappings.`,
);
