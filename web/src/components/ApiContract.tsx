import type { ApiDocEndpoint, ApiDocField } from "../lib/api-docs";
import { CopyBtn } from "./ApiTryPanel";

function FieldTable({
  fields,
  variant,
  emptyLabel,
}: {
  fields: ApiDocField[];
  variant: "in" | "out";
  emptyLabel?: string;
}) {
  if (fields.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-neutral-600">{emptyLabel ?? "—"}</p>
    );
  }

  const accent =
    variant === "in"
      ? "text-emerald-400/90 border-emerald-500/20 bg-emerald-500/[0.06]"
      : "text-cyan-400/90 border-cyan-500/20 bg-cyan-500/[0.06]";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-neutral-600">
            <th className="px-3 py-2 font-semibold">Field</th>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Mô tả</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {fields.map((f) => (
            <tr key={f.name} className="text-neutral-400">
              <td className="px-3 py-2.5 align-top font-mono text-[11px] text-neutral-200">
                {f.name}
                {f.required && <span className="ml-1 text-rose-400">*</span>}
              </td>
              <td className={`px-3 py-2.5 align-top font-mono text-[11px] ${variant === "in" ? "text-emerald-400/80" : "text-cyan-400/80"}`}>
                {f.type}
              </td>
              <td className="px-3 py-2.5 align-top leading-relaxed text-neutral-500">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mx-3 mb-3 mt-2 rounded-md border px-2 py-1 text-[10px] ${accent}`}>
        {variant === "in" ? "↑ Request parameters" : "↓ Response body fields"}
      </p>
    </div>
  );
}

function SampleJson({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="border-t border-white/[0.06] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{label}</p>
        <CopyBtn text={text} label="Copy" />
      </div>
      <pre className="max-h-52 overflow-auto rounded-lg border border-white/[0.06] bg-black p-2.5 font-mono text-[10px] leading-relaxed text-neutral-500">
        {text}
      </pre>
    </div>
  );
}

export function ApiContract({ ep }: { ep: ApiDocEndpoint }) {
  const requestFields: ApiDocField[] =
    ep.params?.map((p) => ({
      name: p.name,
      type: p.type,
      required: p.required,
      description: `${p.description}${p.in === "query" ? " (query)" : " (body)"}`,
    })) ?? [];

  const responseFields = ep.response ?? [];
  const hasRequest = requestFields.length > 0 || ep.method === "POST";
  const hasResponse = responseFields.length > 0 || ep.sampleResponse != null;

  if (!hasRequest && !hasResponse) return null;

  const envelope =
    ep.responseWrap === "root"
      ? `{ "success": true, … }`
      : `{ "success": true, "data": { … } }`;

  return (
    <div className="panel-black mt-6 overflow-hidden rounded-2xl">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">API contract</p>
        <p className="mt-0.5 text-xs text-neutral-600">
          Request ↔ Response schema · envelope: <code className="text-neutral-500">{envelope}</code>
        </p>
      </div>

      <div className="grid divide-y divide-white/[0.06] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div>
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2.5">
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/25">
              In
            </span>
            <span className="text-xs font-medium text-neutral-400">Request</span>
            {ep.method === "GET" && requestFields.length === 0 && (
              <span className="ml-auto text-[10px] text-neutral-600">No params</span>
            )}
          </div>
          <FieldTable
            fields={requestFields}
            variant="in"
            emptyLabel={ep.method === "POST" ? "Xem body mẫu bên Try it" : "Không có query/body bắt buộc"}
          />
          {ep.sample != null && <SampleJson label="Sample request body" value={ep.sample} />}
        </div>

        <div>
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2.5">
            <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400 ring-1 ring-cyan-500/25">
              Out
            </span>
            <span className="text-xs font-medium text-neutral-400">Response</span>
          </div>
          <FieldTable fields={responseFields} variant="out" emptyLabel="Xem sample JSON bên dưới" />
          <SampleJson label="Sample response" value={ep.sampleResponse} />
        </div>
      </div>

      {ep.errors && ep.errors.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Error codes</p>
          <div className="flex flex-wrap gap-2">
            {ep.errors.map((e) => (
              <span
                key={e.status}
                className="rounded-lg border border-rose-500/20 bg-rose-950/30 px-2.5 py-1 text-[11px] text-rose-300"
              >
                <span className="font-mono font-semibold">{e.status}</span> — {e.description}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
