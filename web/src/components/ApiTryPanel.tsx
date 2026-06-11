import { useCallback, useMemo, useState } from "react";
import {
  buildCurl,
  buildFetch,
  buildFullUrl,
  defaultBodyJson,
  defaultQueryString,
  executeApiTry,
  queryRecordToString,
  type ApiDocEndpoint,
} from "../lib/api-docs";

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-white/[0.08] px-2.5 py-1 text-[10px] font-medium text-neutral-500 transition hover:border-white/20 hover:text-white"
    >
      {done ? "Copied" : label}
    </button>
  );
}

function StatusBadge({ status, ms }: { status: number; ms: number }) {
  const ok = status >= 200 && status < 300;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 font-mono text-[11px] ${
        ok
          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
          : "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25"
      }`}
    >
      HTTP {status}
      <span className="text-neutral-500">·</span>
      {ms}ms
    </span>
  );
}

export function ApiTryPanel({ ep, origin }: { ep: ApiDocEndpoint; origin?: string }) {
  const queryParams = ep.params?.filter((p) => p.in === "query") ?? [];
  const hasQueryForm = queryParams.length > 0;

  const [queryFields, setQueryFields] = useState<Record<string, string>>(() => {
    if (ep.tryQuery) return { ...ep.tryQuery };
    if (ep.query) {
      const u = new URLSearchParams(ep.query.replace(/^\?/, ""));
      return Object.fromEntries(u.entries());
    }
    return {};
  });

  const [bodyJson, setBodyJson] = useState(() => defaultBodyJson(ep));
  const [snippetTab, setSnippetTab] = useState<"curl" | "fetch">("curl");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    status: number;
    ms: number;
    body: unknown;
    raw: string;
    ok: boolean;
  } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const queryString = hasQueryForm ? queryRecordToString(queryFields) : defaultQueryString(ep);

  const fullUrl = useMemo(
    () => buildFullUrl(ep.path, queryString, origin),
    [ep.path, queryString, origin],
  );

  const curl = useMemo(
    () => buildCurl({ method: ep.method, path: ep.path, queryString, bodyJson, origin }),
    [ep.method, ep.path, queryString, bodyJson, origin],
  );

  const fetchSnippet = useMemo(
    () => buildFetch({ method: ep.method, path: ep.path, queryString, bodyJson, origin }),
    [ep.method, ep.path, queryString, bodyJson, origin],
  );

  const responseText = useMemo(() => {
    if (!result) return "";
    if (typeof result.body === "string") return result.body;
    return JSON.stringify(result.body, null, 2);
  }, [result]);

  const reset = useCallback(() => {
    if (ep.tryQuery) setQueryFields({ ...ep.tryQuery });
    else if (ep.query) {
      const u = new URLSearchParams(ep.query.replace(/^\?/, ""));
      setQueryFields(Object.fromEntries(u.entries()));
    } else {
      setQueryFields({});
    }
    setBodyJson(defaultBodyJson(ep));
    setResult(null);
    setRunError(null);
  }, [ep]);

  const run = async () => {
    if (ep.method === "POST") {
      try {
        JSON.parse(bodyJson);
      } catch {
        setRunError("JSON body không hợp lệ");
        return;
      }
    }
    setRunning(true);
    setRunError(null);
    try {
      const out = await executeApiTry({
        method: ep.method,
        path: ep.path,
        queryString: ep.method === "GET" ? queryString : undefined,
        bodyJson: ep.method === "POST" ? bodyJson : undefined,
        origin,
      });
      setResult(out);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Request failed");
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="panel-black mt-6 overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/80">Try it</p>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-500">{fullUrl}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CopyBtn text={fullUrl} label="URL" />
          <CopyBtn text={curl} label="cURL" />
          <CopyBtn text={fetchSnippet} label="fetch" />
        </div>
      </div>

      <div className="space-y-4 p-4">
        {hasQueryForm && (
          <div className="grid gap-3 sm:grid-cols-2">
            {queryParams.map((p) => (
              <label key={p.name} className="block">
                <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                  {p.name}
                  {p.required && <span className="text-rose-400">*</span>}
                </span>
                <input
                  value={queryFields[p.name] ?? ""}
                  onChange={(e) => setQueryFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
                  className="w-full rounded-lg border border-white/[0.08] bg-black px-3 py-2 font-mono text-xs text-neutral-200 outline-none focus:border-emerald-500/40"
                  placeholder={p.type}
                />
              </label>
            ))}
          </div>
        )}

        {ep.method === "POST" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                Request body (JSON)
              </span>
              <CopyBtn text={bodyJson} label="Copy body" />
            </div>
            <textarea
              value={bodyJson}
              onChange={(e) => setBodyJson(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-white/[0.08] bg-black p-3 font-mono text-[11px] leading-relaxed text-neutral-300 outline-none focus:border-emerald-500/40"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {running ? "Đang gọi…" : "▶ Chạy thử"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-neutral-500 transition hover:border-white/20 hover:text-white"
          >
            Reset
          </button>
        </div>

        {runError && (
          <p className="rounded-lg border border-rose-500/20 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {runError}
          </p>
        )}

        {result && (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={result.status} ms={result.ms} />
              <CopyBtn text={responseText} label="Copy response" />
            </div>
            <pre
              className={`max-h-80 overflow-auto rounded-xl border p-3 font-mono text-[11px] leading-relaxed ${
                result.ok
                  ? "border-emerald-500/20 bg-emerald-950/20 text-emerald-100/90"
                  : "border-rose-500/20 bg-rose-950/20 text-rose-100/90"
              }`}
            >
              {responseText}
            </pre>
          </div>
        )}

        {/* Snippet preview */}
        <div className="border-t border-white/[0.06] pt-4">
          <div className="mb-2 flex gap-1">
            {(["curl", "fetch"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSnippetTab(t)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  snippetTab === t
                    ? "bg-white/[0.08] text-white"
                    : "text-neutral-600 hover:text-neutral-400"
                }`}
              >
                {t}
              </button>
            ))}
            <CopyBtn text={snippetTab === "curl" ? curl : fetchSnippet} label={`Copy ${snippetTab}`} />
          </div>
          <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black p-3 font-mono text-[11px] leading-relaxed text-neutral-500">
            {snippetTab === "curl" ? curl : fetchSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}

export { CopyBtn };
