import { useMemo, useState } from "react";
import { ApiTryPanel, CopyBtn } from "../components/ApiTryPanel";
import {
  API_DOC_CATEGORIES,
  API_DOCS,
  buildCurl,
  buildFetch,
  defaultBodyJson,
  defaultQueryString,
  type ApiDocCategory,
  type ApiDocEndpoint,
} from "../lib/api-docs";

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={`inline-flex min-w-[3.25rem] justify-center rounded-md px-2 py-1 font-mono text-[11px] font-bold tracking-wide ${
        method === "GET"
          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
          : "bg-white text-black"
      }`}
    >
      {method}
    </span>
  );
}

function ParamsTable({ params }: { params: NonNullable<ApiDocEndpoint["params"]> }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-600">
            <th className="px-3 py-2.5 font-semibold">Param</th>
            <th className="px-3 py-2.5 font-semibold">In</th>
            <th className="px-3 py-2.5 font-semibold">Type</th>
            <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Mô tả</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {params.map((p) => (
            <tr key={p.name} className="text-neutral-400">
              <td className="px-3 py-2.5 font-mono text-neutral-200">
                {p.name}
                {p.required && <span className="ml-1 text-rose-400">*</span>}
              </td>
              <td className="px-3 py-2.5 capitalize text-neutral-500">{p.in}</td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-emerald-400/80">{p.type}</td>
              <td className="hidden px-3 py-2.5 text-neutral-500 sm:table-cell">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleResponseBlock({ ep }: { ep: ApiDocEndpoint }) {
  if (ep.sampleResponse == null) return null;
  const text = JSON.stringify(ep.sampleResponse, null, 2);
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Sample response</p>
        <CopyBtn text={text} label="Copy sample" />
      </div>
      <pre className="max-h-48 overflow-auto rounded-xl border border-white/[0.06] bg-black p-3 font-mono text-[11px] leading-relaxed text-neutral-500">
        {text}
      </pre>
    </div>
  );
}

function EndpointSection({ ep }: { ep: ApiDocEndpoint }) {
  const queryString = defaultQueryString(ep);
  const bodyJson = defaultBodyJson(ep);
  const curl = useMemo(
    () => buildCurl({ method: ep.method, path: ep.path, queryString, bodyJson }),
    [ep.method, ep.path, queryString, bodyJson],
  );
  const fetchSnippet = useMemo(
    () => buildFetch({ method: ep.method, path: ep.path, queryString, bodyJson }),
    [ep.method, ep.path, queryString, bodyJson],
  );

  return (
    <article id={ep.id} className="scroll-mt-24 border-b border-white/[0.06] pb-10 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={ep.method} />
        <code className="font-mono text-sm text-white">{ep.path}</code>
        <CopyBtn text={ep.path} label="Path" />
        <CopyBtn text={curl} label="cURL" />
        <CopyBtn text={fetchSnippet} label="fetch" />
      </div>

      <h3 className="mt-3 text-base font-semibold text-white">{ep.title}</h3>
      <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-neutral-500">{ep.description}</p>

      <ApiTryPanel ep={ep} />

      {ep.params && ep.params.length > 0 && <ParamsTable params={ep.params} />}

      {ep.errors && ep.errors.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {ep.errors.map((e) => (
            <span
              key={e.status}
              className="rounded-lg border border-rose-500/20 bg-rose-950/30 px-2.5 py-1 text-[11px] text-rose-300"
            >
              <span className="font-mono font-semibold">{e.status}</span> — {e.description}
            </span>
          ))}
        </div>
      )}

      <SampleResponseBlock ep={ep} />
    </article>
  );
}

export default function ApiDocsPage() {
  const [category, setCategory] = useState<ApiDocCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return API_DOCS.filter((ep) => {
      if (category !== "all" && ep.category !== category) return false;
      if (!q) return true;
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.title.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  const grouped = useMemo(() => {
    const groups: { cat: (typeof API_DOC_CATEGORIES)[number]; items: ApiDocEndpoint[] }[] = [];
    for (const cat of API_DOC_CATEGORIES) {
      const items = filtered.filter((ep) => ep.category === cat.id);
      if (items.length > 0) groups.push({ cat, items });
    }
    return groups;
  }, [filtered]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex h-full w-full">
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-black p-4 xl:block">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">On this page</p>
        <nav className="mt-3 space-y-4">
          {API_DOC_CATEGORIES.map((cat) => {
            const items = API_DOCS.filter(
              (ep) => ep.category === cat.id && (category === "all" || category === cat.id),
            ).filter((ep) =>
              query.trim()
                ? ep.path.toLowerCase().includes(query.toLowerCase()) ||
                  ep.title.toLowerCase().includes(query.toLowerCase())
                : true,
            );
            if (items.length === 0) return null;
            return (
              <div key={cat.id}>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-700">
                  {cat.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((ep) => (
                    <li key={ep.id}>
                      <button
                        type="button"
                        onClick={() => scrollTo(ep.id)}
                        className="w-full truncate rounded-md px-2 py-1 text-left text-[11px] text-neutral-500 transition hover:bg-white/[0.04] hover:text-neutral-300"
                      >
                        <span className="font-mono text-neutral-600">{ep.method}</span> {ep.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto bg-black p-4 sm:p-6 lg:p-8">
        <header className="mb-8 border-b border-white/[0.06] pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/80">Reference</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">Routing API</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            REST API nội bộ — chạy thử trực tiếp từng endpoint, copy cURL / fetch, xem response live.
          </p>
        </header>

        <div className="panel-black mb-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white">Response envelope</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Thành công:{" "}
            <code className="text-neutral-400">{`{ "success": true, "data": … }`}</code>. Lỗi:{" "}
            <code className="text-neutral-400">{`{ "success": false, "message": "…" }`}</code>.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")} label="Tất cả" />
            {API_DOC_CATEGORIES.map((c) => (
              <FilterChip
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
                label={c.label}
              />
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm endpoint…"
            className="w-full rounded-lg border border-white/[0.08] bg-black px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-emerald-500/40 sm:max-w-xs"
          />
        </div>

        <div className="panel-black mb-10 overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Quick reference</h2>
            <p className="mt-0.5 text-xs text-neutral-600">{filtered.length} endpoints · click để jump</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-neutral-600">
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5">Path</th>
                  <th className="px-4 py-2.5">Mô tả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((ep) => (
                  <tr
                    key={ep.id}
                    className="cursor-pointer text-neutral-400 transition hover:bg-white/[0.02]"
                    onClick={() => scrollTo(ep.id)}
                  >
                    <td className="px-4 py-2.5">
                      <MethodBadge method={ep.method} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-neutral-300">{ep.path}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{ep.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-neutral-600">Không tìm thấy endpoint.</p>
        ) : (
          grouped.map(({ cat, items }) => (
            <section key={cat.id} className="mb-12">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white">{cat.label}</h2>
                <p className="mt-1 text-sm text-neutral-500">{cat.description}</p>
              </div>
              <div className="space-y-10">
                {items.map((ep) => (
                  <EndpointSection key={ep.id} ep={ep} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-white/[0.08] text-neutral-500 hover:border-white/15 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}
