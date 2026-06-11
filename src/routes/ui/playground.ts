import { config } from "../../config/env";

export function renderPlaygroundHtml(): string {
  const nominatimUrl = config.nominatimUrl.replace(/\/$/, "");
  const version = config.version;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Routing API Playground</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    :root {
      --bg: #070b14;
      --surface: #0f1629;
      --surface-2: #151d32;
      --border: rgba(148,163,184,.12);
      --border-hover: rgba(148,163,184,.28);
      --text: #f1f5f9;
      --muted: #94a3b8;
      --dim: #64748b;
      --accent: #10b981;
      --accent-2: #06b6d4;
      --danger: #f43f5e;
      --warn: #f59e0b;
      --violet: #8b5cf6;
      --radius: 12px;
      --shadow: 0 8px 32px rgba(0,0,0,.35);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    body::before {
      content: "";
      position: fixed; inset: 0; pointer-events: none; z-index: 0;
      background:
        radial-gradient(ellipse 80% 50% at 20% -10%, rgba(16,185,129,.15), transparent),
        radial-gradient(ellipse 60% 40% at 90% 10%, rgba(6,182,212,.1), transparent);
    }
    header {
      position: relative; z-index: 10;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: .85rem 1.25rem;
      background: rgba(15,22,41,.75);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; align-items: center; gap: .75rem; }
    .logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      display: grid; place-items: center; font-weight: 700; font-size: .9rem; color: #042f2e;
      box-shadow: 0 4px 14px rgba(16,185,129,.35);
    }
    header h1 { font-size: 1.05rem; font-weight: 600; letter-spacing: -.02em; }
    .meta { font-size: .72rem; color: var(--dim); margin-top: 2px; }
    .status-row { display: flex; gap: .5rem; flex-wrap: wrap; }
    .pill {
      display: inline-flex; align-items: center; gap: .4rem;
      padding: .35rem .65rem; border-radius: 999px; font-size: .72rem; font-weight: 500;
      background: var(--surface-2); border: 1px solid var(--border);
    }
    .pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dim); }
    .pill .dot.ok { background: var(--accent); box-shadow: 0 0 8px rgba(16,185,129,.6); }
    .pill .dot.err { background: var(--danger); box-shadow: 0 0 8px rgba(244,63,94,.5); }
    .pill .dot.loading { background: var(--warn); animation: pulse 1.2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    main {
      position: relative; z-index: 1; flex: 1;
      display: grid; grid-template-columns: minmax(320px, 380px) 1fr minmax(300px, 340px);
      min-height: 0;
    }
    @media (max-width: 1200px) {
      main { grid-template-columns: 1fr; grid-template-rows: auto minmax(340px,1fr) auto; overflow-y: auto; }
      body { overflow: auto; height: auto; min-height: 100vh; }
    }
    .panel-left, .panel-right {
      background: rgba(15,22,41,.6);
      backdrop-filter: blur(12px);
      overflow-y: auto;
      min-height: 0;
    }
    .panel-left { border-right: 1px solid var(--border); padding: 1rem; display: flex; flex-direction: column; gap: .85rem; }
    .panel-right { border-left: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; }
    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: .85rem;
      margin-bottom: 0;
    }
    .section.planner {
      background: linear-gradient(165deg, rgba(16,185,129,.07), rgba(15,22,41,.95) 45%);
      border-color: rgba(16,185,129,.22);
      box-shadow: 0 12px 40px rgba(0,0,0,.22);
    }
    .section-title {
      font-size: .68rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .08em; color: var(--dim); margin-bottom: .65rem;
      display: flex; align-items: center; justify-content: space-between; gap: .4rem;
    }
    .section-title em { font-style: normal; color: var(--accent); font-size: .62rem; letter-spacing: .06em; }
    .search-wrap { position: relative; }
    .search-wrap input {
      width: 100%; padding: .65rem .75rem .65rem 2.2rem;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text); font-size: .82rem;
      transition: border-color .2s, box-shadow .2s;
    }
    .search-wrap input:focus {
      outline: none; border-color: rgba(16,185,129,.5);
      box-shadow: 0 0 0 3px rgba(16,185,129,.12);
    }
    .search-wrap.from input:focus { border-color: rgba(16,185,129,.5); box-shadow: 0 0 0 3px rgba(16,185,129,.12); }
    .search-wrap.to input:focus { border-color: rgba(244,63,94,.5); box-shadow: 0 0 0 3px rgba(244,63,94,.12); }
    .addr-field { margin-bottom: .65rem; }
    .addr-label {
      display: flex; align-items: center; gap: .35rem;
      font-size: .68rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .06em; color: var(--dim); margin-bottom: .35rem;
    }
    .addr-label.from { color: var(--accent); }
    .addr-label.to { color: var(--danger); }
    .addr-label-dot { width: 8px; height: 8px; border-radius: 50%; }
    .addr-label.from .addr-label-dot { background: var(--accent); }
    .addr-label.to .addr-label-dot { background: var(--danger); }
    .addr-swap-row { display: flex; justify-content: center; margin: -.25rem 0 .35rem; }
    .btn-swap {
      width: 32px; height: 32px; border-radius: 8px; padding: 0;
      background: var(--surface-2); border: 1px solid var(--border);
      color: var(--muted); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      transition: border-color .15s, color .15s, transform .15s;
    }
    .btn-swap:hover { border-color: var(--border-hover); color: var(--text); }
    .btn-swap:active { transform: rotate(180deg); }
    .ico {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; flex-shrink: 0;
    }
    .ico svg { width: 100%; height: 100%; display: block; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .ico-xs { width: 12px; height: 12px; }
    .ico-sm { width: 14px; height: 14px; }
    .ico-lg { width: 18px; height: 18px; }
    .btn-swap .ico { margin: 0; }
    .vehicle-toggle {
      display: grid; grid-template-columns: 1fr 1fr; gap: .3rem;
      padding: .3rem; margin-bottom: .65rem;
      background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
    }
    .vehicle-toggle .btn-ghost {
      display: flex; align-items: center; justify-content: center; gap: .4rem;
      border: none; background: transparent; padding: .55rem .4rem;
      font-size: .76rem; font-weight: 600; line-height: 1; border-radius: 8px;
    }
    .vehicle-toggle .ico {
      width: 17px; height: 17px; line-height: 0;
      transform: translateY(1px);
    }
    .vehicle-toggle .btn-ghost.active {
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border);
      box-shadow: 0 2px 8px rgba(0,0,0,.18);
    }
    .vehicle-toggle .btn-ghost.active[data-profile="driving"] { color: var(--accent); border-color: rgba(16,185,129,.35); }
    .vehicle-toggle .btn-ghost.active[data-profile="motorbike"] { color: var(--accent-2); border-color: rgba(6,182,212,.35); }
    .btn-accent { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; }
    .route-opt-head .ico-xs { margin-right: .25rem; vertical-align: -1px; }
    .search-icon {
      position: absolute; left: .75rem; top: 50%; transform: translateY(-50%);
      color: var(--dim); pointer-events: none;
    }
    .search-wrap.from .search-icon { color: var(--accent); }
    .search-wrap.to .search-icon { color: var(--danger); }
    .metric-note { display: none; }
    .addr-results { max-height: 120px; overflow-y: auto; margin-top: .35rem; }
    .addr-results:empty { display: none; }
    .search-actions { display: flex; gap: .4rem; margin-top: .5rem; }
    .btn {
      border: none; border-radius: 8px; cursor: pointer; font-family: inherit;
      font-size: .78rem; font-weight: 500; padding: .5rem .75rem;
      transition: transform .15s, background .15s, border-color .15s;
    }
    .btn:active { transform: scale(.97); }
    .btn-accent {
      background: linear-gradient(135deg, var(--accent), #059669);
      color: #fff; flex: 1;
      box-shadow: 0 4px 14px rgba(16,185,129,.25);
      font-size: .84rem; font-weight: 600; padding: .72rem 1rem;
    }
    .btn-accent:hover { filter: brightness(1.08); }
    .btn-accent:disabled { opacity: .55; cursor: wait; transform: none; }
    .btn-ghost {
      background: transparent; color: var(--muted);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }
    .btn-ghost.active {
      border-color: rgba(16,185,129,.5); color: var(--accent);
      background: rgba(16,185,129,.08);
    }
    .mode-bar { display: flex; gap: .35rem; margin-top: .65rem; }
    .mode-bar .btn-ghost { flex: 1; font-size: .72rem; padding: .45rem; }
    .results-list { max-height: 160px; overflow-y: auto; margin-top: .5rem; }
    .result-item {
      padding: .55rem .6rem; border-radius: 8px; cursor: pointer;
      font-size: .76rem; line-height: 1.4; border: 1px solid transparent;
      transition: background .15s, border-color .15s;
    }
    .result-item:hover { background: var(--surface-2); border-color: var(--border); }
    .result-item.selected { background: rgba(16,185,129,.1); border-color: rgba(16,185,129,.35); }
    .result-item small { display: block; color: var(--dim); font-family: "JetBrains Mono", monospace; font-size: .68rem; margin-top: 3px; }
    .result-item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .4rem; }
    .result-near-badge {
      flex-shrink: 0; font-size: .58rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em; color: var(--accent-2); background: rgba(6,182,212,.12);
      border: 1px solid rgba(6,182,212,.28); border-radius: 999px; padding: .12rem .4rem;
    }
    .addr-label-row { display: flex; align-items: center; justify-content: space-between; gap: .35rem; margin-bottom: .35rem; }
    .addr-label-row .addr-label { margin-bottom: 0; }
    .btn-locate {
      border: 1px solid var(--border); background: var(--surface-2); color: var(--muted);
      border-radius: 8px; padding: .28rem .5rem; font-size: .65rem; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: .3rem;
      transition: border-color .15s, color .15s;
    }
    .btn-locate:hover { border-color: rgba(16,185,129,.4); color: var(--accent); }
    .btn-locate:disabled { opacity: .5; cursor: wait; }
    .recent-wrap { margin-bottom: .55rem; }
    .recent-wrap:empty, .recent-wrap.hidden { display: none; }
    .recent-label {
      font-size: .62rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .06em; color: var(--dim); margin-bottom: .3rem;
    }
    .recent-list { display: flex; flex-wrap: wrap; gap: .3rem; }
    .recent-chip {
      border: 1px solid var(--border); background: var(--surface-2); color: var(--muted);
      border-radius: 999px; padding: .22rem .55rem; font-size: .68rem; cursor: pointer;
      max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .recent-chip:hover { border-color: var(--border-hover); color: var(--text); }
    @media (prefers-reduced-motion: reduce) {
      .leaflet-overlay-pane svg path[class*="route-stream"],
      .leaflet-overlay-pane svg path.route-line-draw,
      .leaflet-overlay-pane svg path.route-line-alt-draw,
      .route-reveal-flash.play,
      .legend-line { animation: none !important; }
    }
    body.reduce-motion .leaflet-overlay-pane svg path[class*="route-stream"],
    body.reduce-motion .leaflet-overlay-pane svg path.route-line-draw,
    body.reduce-motion .leaflet-overlay-pane svg path.route-line-alt-draw,
    body.reduce-motion .route-reveal-flash.play { animation: none !important; }
    .trip-cards { display: flex; flex-direction: column; gap: .45rem; }
    .trip-card {
      display: flex; gap: .65rem; align-items: flex-start;
      padding: .6rem .7rem; border-radius: 10px;
      background: var(--surface-2); border: 1px solid var(--border);
    }
    .trip-card.from { border-left: 3px solid var(--accent); }
    .trip-card.to { border-left: 3px solid var(--danger); }
    .trip-card.wp { border-left: 3px solid var(--accent-2); }
    .trip-badge {
      flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
      display: grid; place-items: center; font-size: .65rem; font-weight: 700;
    }
    .trip-card.from .trip-badge { background: rgba(16,185,129,.2); color: var(--accent); }
    .trip-card.to .trip-badge { background: rgba(244,63,94,.2); color: var(--danger); }
    .trip-card.wp .trip-badge { background: rgba(6,182,212,.2); color: var(--accent-2); }
    .trip-title { font-size: .72rem; font-weight: 600; color: var(--dim); text-transform: uppercase; }
    .trip-name { font-size: .78rem; margin-top: 2px; line-height: 1.35; }
    .trip-coord { font-family: "JetBrains Mono", monospace; font-size: .65rem; color: var(--dim); margin-top: 3px; }
    .seg-tabs {
      display: flex; gap: 2px; padding: 3px;
      background: var(--surface-2); border-radius: 10px; border: 1px solid var(--border);
      margin-bottom: .75rem; overflow-x: auto;
    }
    .seg-tab {
      flex: 1; min-width: fit-content; padding: .45rem .5rem;
      border: none; border-radius: 7px; background: transparent;
      color: var(--muted); font-size: .72rem; font-weight: 500;
      cursor: pointer; font-family: inherit; white-space: nowrap;
    }
    .seg-tab.active {
      background: var(--surface); color: var(--text);
      box-shadow: 0 1px 4px rgba(0,0,0,.25);
    }
    .endpoint-meta {
      display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem;
      font-size: .75rem; color: var(--muted);
    }
    .tag-post { background: rgba(16,185,129,.15); color: #6ee7b7; padding: .12rem .4rem; border-radius: 4px; font-size: .65rem; font-weight: 600; }
    .tag-path { font-family: "JetBrains Mono", monospace; font-size: .72rem; color: var(--accent-2); }
    .api-panel { display: none; }
    .api-panel.active { display: block; }
    textarea.code {
      width: 100%; min-height: 130px; max-height: 200px;
      background: #0a0f1a; border: 1px solid var(--border); border-radius: 10px;
      color: #7dd3fc; padding: .65rem; font-family: "JetBrains Mono", monospace;
      font-size: .7rem; line-height: 1.5; resize: vertical;
    }
    textarea.code:focus { outline: none; border-color: rgba(6,182,212,.4); }
    .row-actions { display: flex; gap: .4rem; margin-top: .55rem; flex-wrap: wrap; }
    .map-stage { position: relative; min-height: 300px; background: #0a101c; overflow: hidden; }
    #map { width: 100%; height: 100%; background: #0a101c; }
    .route-reveal-flash {
      position: absolute; inset: 0; z-index: 998; pointer-events: none;
      opacity: 0; mix-blend-mode: screen;
      background:
        radial-gradient(ellipse 90% 60% at 50% 50%, rgba(16,185,129,.22), transparent 68%),
        linear-gradient(105deg, transparent 40%, rgba(110,231,183,.08) 50%, transparent 60%);
      background-size: 100% 100%, 220% 100%;
    }
    .route-reveal-flash.play {
      animation: route-reveal 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes route-reveal {
      0% { opacity: 0; background-position: 0 0, 100% 0; }
      18% { opacity: 1; }
      100% { opacity: 0; background-position: 0 0, -120% 0; }
    }
    .route-reveal-flash.play.cyan {
      background:
        radial-gradient(ellipse 90% 60% at 50% 50%, rgba(6,182,212,.24), transparent 68%),
        linear-gradient(105deg, transparent 40%, rgba(34,211,238,.1) 50%, transparent 60%);
      background-size: 100% 100%, 220% 100%;
    }
    .map-legend {
      position: absolute; bottom: 16px; left: 16px; z-index: 1000;
      display: flex; gap: .65rem; flex-wrap: wrap;
      background: rgba(15,22,41,.88); backdrop-filter: blur(12px);
      border: 1px solid var(--border); border-radius: 999px;
      padding: .45rem .85rem; font-size: .68rem; color: var(--muted);
      pointer-events: none;
    }
    .legend-item { display: inline-flex; align-items: center; gap: .35rem; }
    .legend-line { width: 18px; height: 3px; border-radius: 999px; }
    .legend-line.active {
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      background-size: 200% 100%;
      animation: legend-stream 1.2s linear infinite;
      box-shadow: 0 0 10px rgba(16,185,129,.55);
    }
    @keyframes legend-stream {
      to { background-position: 200% 0; }
    }
    .legend-line.active.cyan {
      background: linear-gradient(90deg, transparent, #22d3ee, transparent);
      background-size: 200% 100%;
      box-shadow: 0 0 10px rgba(34,211,238,.55);
    }
    .legend-line.alt {
      background: linear-gradient(90deg, transparent, #64748b, transparent);
      background-size: 200% 100%;
      animation: legend-stream 2.4s linear infinite;
      opacity: 0.75;
      height: 2px;
    }
    .map-loader {
      position: absolute; inset: 0; z-index: 999;
      background: rgba(7,11,20,.45); backdrop-filter: blur(2px);
      display: none; place-items: center;
    }
    .map-loader.show { display: grid; }
    .spinner {
      width: 36px; height: 36px; border: 3px solid rgba(255,255,255,.1);
      border-top-color: var(--accent); border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .leaflet-overlay-pane svg path.route-line-draw {
      animation: route-draw 1.1s cubic-bezier(0.12, 1, 0.28, 1) forwards;
    }
    @keyframes route-draw { to { stroke-dashoffset: 0; } }
    .leaflet-overlay-pane svg path.route-core-live {
      animation: core-breathe 2.6s ease-in-out infinite;
    }
    @keyframes core-breathe {
      0%, 100% { opacity: 0.82; }
      50% { opacity: 1; }
    }
    .leaflet-overlay-pane svg path.route-glow-halo {
      animation: route-halo 2.2s ease-in-out infinite;
    }
    @keyframes route-halo {
      0%, 100% { opacity: 0.08; }
      50% { opacity: 0.28; }
    }
    .leaflet-overlay-pane svg path.route-glow-outer {
      animation: route-halo 3.4s ease-in-out infinite reverse;
      opacity: 0.06;
    }
    .leaflet-overlay-pane svg path.route-stream-ghost {
      stroke-dasharray: 2 36;
      animation: stream-ghost 3.8s linear infinite reverse;
    }
    .leaflet-overlay-pane svg path.route-stream-tail {
      stroke-dasharray: 4 28;
      animation: stream-tail 1.85s linear infinite;
    }
    .leaflet-overlay-pane svg path.route-stream-mid {
      stroke-dasharray: 8 22;
      animation: stream-mid 0.92s linear infinite;
    }
    .leaflet-overlay-pane svg path.route-stream-burst {
      stroke-dasharray: 1 11;
      animation: stream-burst 0.32s linear infinite;
    }
    .leaflet-overlay-pane svg path.route-stream-core {
      stroke-dasharray: 3 12;
      animation: stream-core 0.42s linear infinite;
    }
    .leaflet-overlay-pane svg path.route-stream-scan {
      stroke-dasharray: 1 120;
      animation: stream-scan 2.6s linear infinite;
    }
    @keyframes stream-ghost { to { stroke-dashoffset: 38; } }
    @keyframes stream-tail { to { stroke-dashoffset: -32; } }
    @keyframes stream-mid { to { stroke-dashoffset: -30; } }
    @keyframes stream-burst { to { stroke-dashoffset: -12; } }
    @keyframes stream-core { to { stroke-dashoffset: -15; } }
    @keyframes stream-scan { to { stroke-dashoffset: -121; } }
    .leaflet-overlay-pane svg path.route-line-alt-draw {
      animation: route-draw-alt 1.5s cubic-bezier(0.12, 1, 0.28, 1) forwards;
    }
    @keyframes route-draw-alt { to { stroke-dashoffset: 0; } }
    .leaflet-overlay-pane svg path.route-stream-alt {
      stroke-dasharray: 5 16;
      animation: stream-alt 2.4s linear infinite;
      opacity: 0.42;
    }
    @keyframes stream-alt { to { stroke-dashoffset: -21; } }
    .metrics {
      display: flex; align-items: stretch; gap: 0;
      padding: .55rem .75rem; border-bottom: 1px solid var(--border);
      background: rgba(15,22,41,.45);
    }
    .metric-chip {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1px; padding: .2rem .35rem;
    }
    .metric-chip-val {
      font-size: .92rem; font-weight: 700; letter-spacing: -.02em;
      color: var(--text); line-height: 1.2;
    }
    .metric-chip-val.accent { color: #6ee7b7; }
    .metric-chip-val.cyan { color: #67e8f9; }
    .metric-chip-val.muted { color: var(--muted); font-size: .78rem; font-weight: 600; }
    .metric-chip-lbl {
      font-size: .58rem; color: var(--dim); text-transform: uppercase;
      letter-spacing: .06em; line-height: 1.2;
    }
    .metric-divider {
      width: 1px; align-self: stretch; margin: .15rem 0;
      background: var(--border); flex-shrink: 0;
    }
    .metric-duration {
      display: none;
      flex: 1; min-width: 0; flex-direction: column; align-items: center; justify-content: center;
      gap: 1px; padding: .2rem .35rem;
    }
    .metric-duration.visible { display: flex; }
    .metric-duration-note {
      font-size: .52rem; color: var(--dim); text-align: center;
      line-height: 1.25; max-width: 6.5rem; margin-top: 1px;
    }
    .routes-panel {
      padding: .75rem; border-bottom: 1px solid var(--border);
      max-height: 220px; overflow-y: auto;
    }
    .routes-panel:empty { display: none; }
    .routes-panel-title {
      font-size: .68rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .08em; color: var(--dim); margin-bottom: .55rem;
    }
    .dev-panel { margin-top: auto; }
    .dev-panel summary {
      cursor: pointer; font-size: .72rem; font-weight: 600; color: var(--muted);
      list-style: none; display: flex; align-items: center; justify-content: space-between;
    }
    .dev-panel summary::-webkit-details-marker { display: none; }
    .dev-panel[open] summary { color: var(--text); margin-bottom: .65rem; }
    .dev-panel .section { padding: 0; border: none; background: transparent; }
    .trip-cards.compact { margin-top: .65rem; gap: .35rem; }
    .trip-cards.compact .trip-card { padding: .5rem .6rem; }
    .trip-cards.compact .trip-coord { display: none; }
    .metric-lbl { font-size: .62rem; color: var(--dim); text-transform: uppercase; margin-top: 2px; letter-spacing: .04em; }
    .out-tabs {
      display: flex; border-bottom: 1px solid var(--border);
      padding: 0 .75rem; gap: .25rem;
    }
    .out-tab {
      padding: .55rem .65rem; border: none; background: none;
      color: var(--dim); font-size: .72rem; font-weight: 500; cursor: pointer;
      border-bottom: 2px solid transparent; margin-bottom: -1px; font-family: inherit;
    }
    .out-tab.active { color: var(--text); border-bottom-color: var(--accent); }
    .out-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: .5rem .75rem; gap: .5rem;
    }
    .http-badge {
      font-family: "JetBrains Mono", monospace; font-size: .68rem;
      padding: .2rem .5rem; border-radius: 6px; font-weight: 600;
    }
    .http-badge.ok { background: rgba(16,185,129,.15); color: #6ee7b7; }
    .http-badge.fail { background: rgba(244,63,94,.15); color: #fda4af; }
    .http-badge.pending { background: var(--surface-2); color: var(--dim); }
    .timing { font-size: .68rem; color: var(--dim); font-family: "JetBrains Mono", monospace; }
    .out-body { flex: 1; overflow: auto; min-height: 0; }
    pre.json-out {
      padding: .75rem; font-family: "JetBrains Mono", monospace;
      font-size: .68rem; line-height: 1.55; color: #cbd5e1; white-space: pre-wrap;
      word-break: break-word;
    }
    .summary-out { padding: .75rem; font-size: .78rem; line-height: 1.55; color: var(--muted); }
    .summary-out strong { color: var(--text); }
    .summary-row { padding: .45rem 0; border-bottom: 1px solid var(--border); }
    .matrix-wrap { padding: .75rem; overflow: auto; }
    .matrix-table { width: 100%; border-collapse: collapse; font-size: .68rem; }
    .matrix-table th, .matrix-table td {
      border: 1px solid var(--border); padding: .4rem; text-align: center;
    }
    .matrix-table th { background: var(--surface-2); color: var(--dim); font-weight: 500; }
    .matrix-table td small { color: var(--dim); display: block; margin-top: 2px; }
    .toast {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(80px);
      background: var(--surface-2); border: 1px solid var(--border);
      padding: .65rem 1rem; border-radius: 999px; font-size: .78rem;
      box-shadow: var(--shadow); z-index: 9999; opacity: 0;
      transition: transform .3s, opacity .3s; pointer-events: none;
    }
    .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
    .hint { font-size: .68rem; color: var(--dim); line-height: 1.45; margin-top: .5rem; }
    .hint code { font-family: "JetBrains Mono", monospace; font-size: .65rem; color: var(--accent-2); }
    .route-opt-head strong.duration { display: none; color: var(--text); font-size: .82rem; }
    .route-opt-head strong.duration.visible { display: inline; }
    .route-opt-duration-note { display: none; font-size: .58rem; color: var(--dim); margin-top: 2px; }
    .route-opt-duration-note.visible { display: block; }
    .route-opt-meta .route-dist { font-weight: 500; color: var(--muted); }
    .toggle-row {
      display: flex; align-items: center; gap: .5rem; margin-top: .65rem;
      font-size: .74rem; color: var(--muted); cursor: pointer;
    }
    .toggle-row input { accent-color: var(--accent); }
    .route-opt {
      padding: .6rem .65rem; border-radius: 10px; cursor: pointer;
      background: var(--surface-2); border: 1px solid var(--border);
      margin-bottom: .45rem; transition: border-color .15s, background .15s;
    }
    .route-opt:hover { border-color: var(--border-hover); }
    .route-opt.active {
      border-color: rgba(16,185,129,.45);
      background: rgba(16,185,129,.08);
      box-shadow: inset 3px 0 0 var(--accent);
      transform: translateX(2px);
    }
    .route-opt-head {
      display: flex; justify-content: space-between; align-items: center;
      font-size: .78rem; font-weight: 600;
    }
    .route-opt-head span { color: var(--muted); font-size: .68rem; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
    .route-opt.active .route-opt-head span { color: var(--accent); }
    .route-opt-meta { font-size: .72rem; color: var(--dim); margin-top: 4px; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo">R</div>
      <div>
        <h1>Routing API Playground</h1>
        <p class="meta">v${version} · OSRM routing · geocode via API</p>
      </div>
    </div>
    <div class="status-row">
      <span class="pill"><span class="dot" id="healthDot"></span><span id="healthText">API</span></span>
      <span class="pill"><span class="dot" id="osrmDot"></span><span id="osrmText">OSRM</span></span>
      <span class="pill"><span class="dot" id="geoDot"></span><span id="geoText">Geocode</span></span>
    </div>
  </header>

  <svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">
    <defs>
      <filter id="neon-emerald" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b1"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="b2"/>
        <feMerge>
          <feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="neon-cyan" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b1"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="b2"/>
        <feMerge>
          <feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <symbol id="ico-locate" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></symbol>
    <symbol id="ico-car" viewBox="0 0 24 24"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M5 11v5a1 1 0 0 0 1 1h1"/><path d="M17 17h1a1 1 0 0 0 1-1v-5"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></symbol>
    <symbol id="ico-motor" viewBox="0 0 24 24"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M8 17h8"/><path d="M8 17l2-6h3l2 3h4"/></symbol>
    <symbol id="ico-swap" viewBox="0 0 24 24"><path d="M7 16V4M7 4L3 8M7 4l4 4"/><path d="M17 8v12M17 20l4-4M17 20l-4-4"/></symbol>
    <symbol id="ico-star" viewBox="0 0 24 24"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 14.9 7.2 17.8l.9-5.3L4.2 7.7l5.4-.8L12 2z"/></symbol>
    <symbol id="ico-route" viewBox="0 0 24 24"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M8.6 17.4L15.4 6.6"/></symbol>
    <symbol id="ico-pin" viewBox="0 0 24 24"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></symbol>
  </svg>

  <main>
    <aside class="panel-left">
      <div class="section planner">
        <div class="section-title">Điểm đi &amp; đến <em>Routing</em></div>
        <div class="addr-field">
          <div class="addr-label-row">
            <div class="addr-label from"><span class="addr-label-dot"></span> From</div>
            <button type="button" class="btn-locate" id="useCurrentLocationBtn" title="Dùng vị trí hiện tại">
              <span class="ico ico-xs"><svg viewBox="0 0 24 24"><use href="#ico-locate"/></svg></span>
              Vị trí hiện tại
            </button>
          </div>
          <div class="search-wrap from">
            <span class="search-icon ico"><svg viewBox="0 0 24 24"><use href="#ico-pin"/></svg></span>
            <input id="fromQuery" type="text" placeholder="230/25 Lạc Long Quân, Bình Thới, HCM" autocomplete="off" />
          </div>
          <div class="addr-results results-list" id="fromResults"></div>
        </div>
        <div class="recent-wrap hidden" id="recentSearchesWrap">
          <div class="recent-label">Tìm gần đây</div>
          <div class="recent-list" id="recentSearchesList"></div>
        </div>
        <div class="addr-swap-row">
          <button type="button" class="btn-swap" id="swapAddrBtn" title="Đổi From ↔ To"><span class="ico"><svg viewBox="0 0 24 24"><use href="#ico-swap"/></svg></span></button>
        </div>
        <div class="addr-field">
          <div class="addr-label to"><span class="addr-label-dot"></span> To</div>
          <div class="search-wrap to">
            <span class="search-icon ico"><svg viewBox="0 0 24 24"><use href="#ico-pin"/></svg></span>
            <input id="toQuery" type="text" placeholder="Trần Não, An Khánh, HCM" autocomplete="off" />
          </div>
          <div class="addr-results results-list" id="toResults"></div>
        </div>
        <div class="vehicle-toggle" id="vehicleToggle">
          <button type="button" class="btn btn-ghost active" data-profile="driving"><span class="ico"><svg viewBox="0 0 24 24"><use href="#ico-car"/></svg></span><span>Ô tô</span></button>
          <button type="button" class="btn btn-ghost" data-profile="motorbike"><span class="ico"><svg viewBox="0 0 24 24"><use href="#ico-motor"/></svg></span><span>Xe máy</span></button>
        </div>
        <label class="toggle-row">
          <input type="checkbox" id="alternativesToggle" checked />
          Tuyến thay thế
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="streamFxToggle" checked />
          Hiệu ứng tuyến đường
        </label>
        <div class="search-actions" style="margin-top:.65rem">
          <button type="button" class="btn btn-accent" id="routeByAddrBtn"><span class="ico ico-lg"><svg viewBox="0 0 24 24"><use href="#ico-route"/></svg></span> Tìm đường</button>
        </div>
        <div class="trip-cards compact" id="routePoints"></div>
      </div>

      <details class="section dev-panel">
        <summary>API Developer ▸</summary>
        <div class="section">
        <div class="seg-tabs" id="endpointTabs">
          <button class="seg-tab active" data-tab="route">Route</button>
          <button class="seg-tab" data-tab="table">Table</button>
          <button class="seg-tab" data-tab="nearest">Nearest</button>
          <button class="seg-tab" data-tab="match">Match</button>
          <button class="seg-tab" data-tab="trip">Trip</button>
        </div>

        <div class="api-panel active" data-panel="route">
          <div class="endpoint-meta"><span class="tag-post">POST</span><span class="tag-path">/api/route</span></div>
          <textarea class="code payload" data-endpoint="route"></textarea>
          <div class="row-actions">
            <button class="btn btn-accent send" data-endpoint="route" data-path="/api/route">Run route</button>
            <button class="btn btn-ghost reset" data-endpoint="route">Reset</button>
          </div>
        </div>
        <div class="api-panel" data-panel="table">
          <div class="endpoint-meta"><span class="tag-post">POST</span><span class="tag-path">/api/table</span></div>
          <textarea class="code payload" data-endpoint="table"></textarea>
          <div class="row-actions">
            <button class="btn btn-accent send" data-endpoint="table" data-path="/api/table">Run table</button>
            <button class="btn btn-ghost reset" data-endpoint="table">Reset</button>
          </div>
        </div>
        <div class="api-panel" data-panel="nearest">
          <div class="endpoint-meta"><span class="tag-post">POST</span><span class="tag-path">/api/nearest</span></div>
          <textarea class="code payload" data-endpoint="nearest"></textarea>
          <div class="row-actions">
            <button class="btn btn-accent send" data-endpoint="nearest" data-path="/api/nearest">Run</button>
            <button class="btn btn-ghost reset" data-endpoint="nearest">Reset</button>
          </div>
        </div>
        <div class="api-panel" data-panel="match">
          <div class="endpoint-meta"><span class="tag-post">POST</span><span class="tag-path">/api/match</span></div>
          <textarea class="code payload" data-endpoint="match"></textarea>
          <div class="row-actions">
            <button class="btn btn-accent send" data-endpoint="match" data-path="/api/match">Run</button>
            <button class="btn btn-ghost reset" data-endpoint="match">Reset</button>
          </div>
        </div>
        <div class="api-panel" data-panel="trip">
          <div class="endpoint-meta"><span class="tag-post">POST</span><span class="tag-path">/api/trip</span></div>
          <textarea class="code payload" data-endpoint="trip"></textarea>
          <div class="row-actions">
            <button class="btn btn-accent send" data-endpoint="trip" data-path="/api/trip">Run trip</button>
            <button class="btn btn-ghost reset" data-endpoint="trip">Reset</button>
          </div>
        </div>
        </div>
      </details>
    </aside>

    <div class="map-stage">
      <div id="map"></div>
      <div class="route-reveal-flash" id="routeRevealFlash"></div>
      <div class="map-loader" id="mapLoader"><div class="spinner"></div></div>
      <div class="map-legend" id="mapLegend" style="display:none">
        <span class="legend-item"><span class="legend-line active"></span> Tuyến chọn</span>
        <span class="legend-item"><span class="legend-line alt"></span> Thay thế</span>
      </div>
    </div>

    <aside class="panel-right">
      <div class="metrics" id="metricsGrid">
        <div class="metric-chip">
          <span class="metric-chip-val" id="statDistance">—</span>
          <span class="metric-chip-lbl">Quãng đường</span>
        </div>
        <div class="metric-divider" id="metricDividerDuration"></div>
        <div class="metric-duration" id="metricDuration">
          <span class="metric-chip-val accent" id="statDuration">—</span>
          <span class="metric-chip-lbl">Thời gian</span>
          <span class="metric-duration-note">Giả định không kẹt xe</span>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-chip">
          <span class="metric-chip-val cyan" id="statRoutes">—</span>
          <span class="metric-chip-lbl">Tuyến</span>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-chip">
          <span class="metric-chip-val muted" id="statVehicle">—</span>
          <span class="metric-chip-lbl">Phương tiện</span>
        </div>
      </div>
      <div class="routes-panel" id="routeOptionsPanel">
        <div class="routes-panel-title">Chọn tuyến</div>
        <div id="routeOptionsList"></div>
      </div>
      <div class="out-tabs">
        <button class="out-tab active" data-out="summary">Summary</button>
        <button class="out-tab" data-out="json">JSON</button>
        <button class="out-tab" data-out="matrix">Matrix</button>
      </div>
      <div class="out-head">
        <span class="http-badge pending" id="statusBadge">—</span>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="timing" id="timing"></span>
          <button class="btn btn-ghost" id="copyBtn" style="padding:.3rem .55rem;font-size:.68rem">Copy</button>
        </div>
      </div>
      <div class="out-body">
        <div id="viewSummary" class="summary-out">Chọn <strong>Ô tô</strong> hoặc <strong>Xe máy</strong>, nhập địa chỉ rồi bấm <strong>Tìm đường</strong>.</div>
        <pre id="viewJson" class="json-out" style="display:none">{}</pre>
        <div id="viewMatrix" class="matrix-wrap" style="display:none"></div>
      </div>
    </aside>
  </main>

  <div class="toast" id="toast"></div>

  <script>
    const DEFAULT_FROM = {
      lat: 10.7635,
      lng: 106.644,
      name: "230/25 Lạc Long Quân, Bình Thới, Hồ Chí Minh, Việt Nam",
    };
    const DEFAULT_TO = {
      lat: 10.795112,
      lng: 106.731227,
      name: "Trần Não, An Khánh, Hồ Chí Minh, Việt Nam",
    };
    const PROFILE_LABELS = { driving: "Ô tô", motorbike: "Xe máy" };
    /** Bật true khi muốn hiện ETA — luôn kèm nhãn "giả định không kẹt xe" */
    const SHOW_DURATION_UI = true;
    const DURATION_DISCLAIMER = "Giả định không kẹt xe";
    const GEOCODE_DEBOUNCE_MS = 650;
    const GEOCODE_MIN_INTERVAL_MS = 800;
    const NEAR_KM = 25;
    const RECENT_KEY = "routing-playground-recent";
    const MAX_RECENT = 8;
    let cachedDurationMeta = null;
    let hasRoutedOnce = false;

    function hasDuration(v) {
      return typeof v === "number" && Number.isFinite(v) && v > 0;
    }

    function shouldShowDuration(meta, dur) {
      return SHOW_DURATION_UI && meta?.available === true && hasDuration(dur);
    }

    function durationLabel(seconds) {
      return fmtDur(seconds) + " · " + DURATION_DISCLAIMER;
    }

    function ico(id, cls) {
      return '<span class="ico ' + (cls || "") + '"><svg viewBox="0 0 24 24"><use href="#ico-' + id + '"/></svg></span>';
    }

    const samples = {
      route: {
        from: { lat: DEFAULT_FROM.lat, lng: DEFAULT_FROM.lng },
        to: { lat: DEFAULT_TO.lat, lng: DEFAULT_TO.lng },
        profile: "driving",
        alternatives: true,
      },
      table: { sources: [{ lat: DEFAULT_FROM.lat, lng: DEFAULT_FROM.lng }], destinations: [{ lat: DEFAULT_TO.lat, lng: DEFAULT_TO.lng }, { lat: 10.823099, lng: 106.629664 }] },
      nearest: { lat: DEFAULT_FROM.lat, lng: DEFAULT_FROM.lng },
      match: { points: [{ lat: DEFAULT_FROM.lat, lng: DEFAULT_FROM.lng }, { lat: 10.779, lng: 106.688 }, { lat: DEFAULT_TO.lat, lng: DEFAULT_TO.lng }] },
      trip: { points: [{ lat: DEFAULT_FROM.lat, lng: DEFAULT_FROM.lng }, { lat: DEFAULT_TO.lat, lng: DEFAULT_TO.lng }, { lat: 10.823099, lng: 106.629664 }], roundtrip: false }
    };

    let fromPoint = { ...DEFAULT_FROM };
    let toPoint = { ...DEFAULT_TO };
    let waypoints = [];
    let lastJson = null;
    let geocodeTimer = null;
    let lastGeocodeAt = 0;
    let routingProfile = "driving";
    let alternativesEnabled = true;
    let cachedRouteOptions = [];
    let activeRouteIndex = 0;
    let searchBias = { lat: 10.779, lng: 106.688, source: "default" };
    let userGps = null;
    let mapBiasTimer = null;
    let activeGeocodeQuery = "";
    let prefetchedRouteKey = null;
    let prefetchedRouteData = null;
    let prefetchedRoutePromise = null;
    let streamEffectsEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      && localStorage.getItem("routeFx") !== "off";
    if (!streamEffectsEnabled) document.body.classList.add("reduce-motion");

    const fromInput = document.getElementById("fromQuery");
    const toInput = document.getElementById("toQuery");
    fromInput.value = fromPoint.name;
    toInput.value = toPoint.name;

    const map = L.map("map", { zoomControl: true }).setView([10.779, 106.688], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OSM &copy; CARTO",
      maxZoom: 20
    }).addTo(map);

    const routeLayer = L.layerGroup().addTo(map);
    const markerLayer = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);

    function setUserLocationMarker(lat, lng) {
      userLayer.clearLayers();
      L.circleMarker([lat, lng], {
        radius: 16,
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        color: "#3b82f6",
        weight: 1,
        opacity: 0.35,
        interactive: false,
      }).addTo(userLayer);
      L.circleMarker([lat, lng], {
        radius: 6,
        fillColor: "#60a5fa",
        fillOpacity: 0.95,
        color: "#fff",
        weight: 2,
      }).bindPopup("<b>Vị trí của bạn</b><br><small>Search ưu tiên gần đây</small>").addTo(userLayer);
    }

    function updateGeoPill() {
      const geoText = document.getElementById("geoText");
      if (!geoText) return;
      if (searchBias.source === "gps") {
        geoText.textContent = "GPS · Geo";
        geoText.title = "Search ưu tiên gần vị trí của bạn";
      } else if (searchBias.source === "map") {
        geoText.textContent = "Map · Geo";
        geoText.title = "Search ưu tiên theo vùng bản đồ";
      } else {
        geoText.textContent = "Geo";
        geoText.title = "Geocoding qua API";
      }
    }

    function initSearchLocation() {
      const useMapCenter = () => {
        const c = map.getCenter();
        searchBias = { lat: c.lat, lng: c.lng, source: "map" };
        updateGeoPill();
      };

      if (!navigator.geolocation) {
        useMapCenter();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          searchBias = { lat: userGps.lat, lng: userGps.lng, source: "gps" };
          setUserLocationMarker(searchBias.lat, searchBias.lng);
          updateGeoPill();
          map.setView([searchBias.lat, searchBias.lng], Math.max(map.getZoom(), 13), { animate: true });
        },
        () => useMapCenter(),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 },
      );
    }

    function syncMapSearchBias() {
      const c = map.getCenter();
      if (userGps) {
        const dLat = Math.abs(c.lat - userGps.lat);
        const dLng = Math.abs(c.lng - userGps.lng);
        if (dLat < 0.01 && dLng < 0.01) {
          searchBias = { lat: userGps.lat, lng: userGps.lng, source: "gps" };
        } else {
          searchBias = { lat: c.lat, lng: c.lng, source: "map" };
        }
      } else {
        searchBias = { lat: c.lat, lng: c.lng, source: "map" };
      }
      updateGeoPill();
    }

    map.on("moveend", () => {
      clearTimeout(mapBiasTimer);
      mapBiasTimer = setTimeout(syncMapSearchBias, 450);
    });

    initSearchLocation();

    function getPathEl(layer) {
      return layer && (layer.getElement ? layer.getElement() : layer._path);
    }

    function streamPalette(profile) {
      if (profile === "motorbike") {
        return {
          core: "#ffffff",
          burst: "#a5f3fc",
          mid: "#22d3ee",
          tail: "#0891b2",
          ghost: "#164e63",
          scan: "#67e8f9",
          halo: "#06b6d4",
          neon: "url(#neon-cyan)",
        };
      }
      return {
        core: "#ffffff",
        burst: "#a7f3d0",
        mid: "#34d399",
        tail: "#059669",
        ghost: "#064e3b",
        scan: "#6ee7b7",
        halo: "#10b981",
        neon: "url(#neon-emerald)",
      };
    }

    function playRouteReveal() {
      const flash = document.getElementById("routeRevealFlash");
      if (!flash) return;
      flash.classList.remove("play", "cyan");
      void flash.offsetWidth;
      flash.classList.add("play", routingProfile === "motorbike" ? "cyan" : "");
    }

    function styleStreamEl(el, opts) {
      if (!el) return;
      if (opts.filter) el.style.filter = opts.filter;
      if (opts.delay != null) el.style.animationDelay = opts.delay;
      if (opts.neon) el.setAttribute("filter", opts.neon);
    }

    function addDataStreams(latlngs, profile) {
      const c = streamPalette(profile);
      const base = { lineCap: "round", lineJoin: "round", interactive: false };

      if (!streamEffectsEnabled) {
        L.polyline(latlngs, { ...base, color: c.mid, weight: 4, opacity: 0.88 }).addTo(routeLayer);
        return;
      }

      L.polyline(latlngs, { ...base, color: c.halo, weight: 20, opacity: 0.07, className: "route-glow-outer" }).addTo(routeLayer);
      L.polyline(latlngs, { ...base, color: c.halo, weight: 13, opacity: 0.16, className: "route-glow-halo" }).addTo(routeLayer);

      const ghost = L.polyline(latlngs, { ...base, color: c.ghost, weight: 6, opacity: 0.35, className: "route-stream-ghost" }).addTo(routeLayer);
      const tail = L.polyline(latlngs, { ...base, color: c.tail, weight: 5, opacity: 0.5, className: "route-stream-tail" }).addTo(routeLayer);
      const mid = L.polyline(latlngs, { ...base, color: c.mid, weight: 3, opacity: 0.72, className: "route-stream-mid" }).addTo(routeLayer);
      const burst = L.polyline(latlngs, { ...base, color: c.burst, weight: 2, opacity: 0.88, className: "route-stream-burst" }).addTo(routeLayer);
      const core = L.polyline(latlngs, { ...base, color: c.core, weight: 1.8, opacity: 0.98, className: "route-stream-core" }).addTo(routeLayer);
      const scan = L.polyline(latlngs, { ...base, color: c.scan, weight: 4, opacity: 0.28, className: "route-stream-scan" }).addTo(routeLayer);

      afterPathReady(ghost, el => styleStreamEl(el, { delay: "-2.2s" }));
      afterPathReady(tail, el => styleStreamEl(el, { delay: "-1.35s" }));
      afterPathReady(mid, el => styleStreamEl(el, { delay: "-0.62s", neon: c.neon }));
      afterPathReady(burst, el => styleStreamEl(el, { delay: "-0.08s", neon: c.neon }));
      afterPathReady(core, el => styleStreamEl(el, { delay: "-0.18s", neon: c.neon }));
      afterPathReady(scan, el => styleStreamEl(el, { delay: "-0.95s" }));
    }

    function animatePathEl(el, kind) {
      if (!el || typeof el.getTotalLength !== "function") return;
      const len = Math.ceil(el.getTotalLength());
      if (!len) return;
      el.style.strokeDasharray = len + " " + len;
      el.style.strokeDashoffset = String(len);
      if (kind === "active-draw") {
        el.classList.add("route-line-draw");
        el.addEventListener("animationend", function onDrawEnd() {
          el.classList.remove("route-line-draw");
          el.style.strokeDasharray = "";
          el.style.strokeDashoffset = "";
          el.classList.add("route-core-live");
          el.setAttribute("filter", streamPalette(routingProfile).neon);
          playRouteReveal();
        }, { once: true });
      } else if (kind === "alt-draw") {
        el.classList.add("route-line-alt-draw");
        el.addEventListener("animationend", function onAltEnd() {
          el.classList.remove("route-line-alt-draw");
          el.style.strokeDasharray = "";
          el.style.strokeDashoffset = "";
          el.classList.add("route-stream-alt");
        }, { once: true });
      }
    }

    function afterPathReady(layer, fn) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = getPathEl(layer);
        if (el) fn(el);
      }));
    }

    function mkIcon(color, label) {
      return L.divIcon({
        className: "",
        html: '<div style="position:relative;width:32px;height:32px">' +
          '<div style="background:' + color + ';width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.4);margin:2px auto"></div>' +
          '<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:700;color:#fff">' + label + '</div></div>',
        iconSize: [32, 32], iconAnchor: [16, 28]
      });
    }
    const fromIcon = mkIcon("#10b981", "A");
    const toIcon = mkIcon("#f43f5e", "B");
    const wpIcon = mkIcon("#06b6d4", "·");

    function fmtDist(m) {
      if (m == null || m === undefined) return "—";
      return m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m";
    }
    function fmtDur(s) {
      if (!hasDuration(s)) return "";
      const totalMin = Math.max(1, Math.round(s / 60));
      if (totalMin >= 60) {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return h + " giờ " + m + " phút";
      }
      return totalMin + " phút";
    }

    function toast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2600);
    }

    function syncAddrInputs() {
      fromInput.value = fromPoint.name || fromPoint.lat.toFixed(5) + ", " + fromPoint.lng.toFixed(5);
      toInput.value = toPoint.name || toPoint.lat.toFixed(5) + ", " + toPoint.lng.toFixed(5);
    }

    function routeBodyKey(body) {
      return JSON.stringify(body);
    }

    function invalidatePrefetch() {
      prefetchedRouteKey = null;
      prefetchedRouteData = null;
      prefetchedRoutePromise = null;
    }

    async function prefetchRoute() {
      if (!fromPoint?.lat || !toPoint?.lat) return;
      const body = getRouteBody();
      const key = routeBodyKey(body);
      if (prefetchedRouteKey === key && prefetchedRouteData) return;
      if (prefetchedRouteKey === key && prefetchedRoutePromise) return prefetchedRoutePromise;

      prefetchedRouteKey = key;
      prefetchedRoutePromise = fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data) {
            prefetchedRouteData = json.data;
          } else {
            invalidatePrefetch();
          }
          return json;
        })
        .catch(() => {
          invalidatePrefetch();
        });
      return prefetchedRoutePromise;
    }

    function applyPrefetchedRouteIfReady() {
      const key = routeBodyKey(getRouteBody());
      if (prefetchedRouteKey !== key || !prefetchedRouteData) return false;
      handleRouteResponse(prefetchedRouteData);
      lastJson = { success: true, data: prefetchedRouteData };
      document.getElementById("viewJson").textContent = JSON.stringify(lastJson, null, 2);
      setOutTab("summary");
      setStatus(200, 0);
      return true;
    }

    function getRouteBody() {
      return {
        from: { lat: fromPoint.lat, lng: fromPoint.lng },
        to: { lat: toPoint.lat, lng: toPoint.lng },
        profile: routingProfile,
        alternatives: alternativesEnabled,
      };
    }

    function syncRouteJson() {
      document.querySelector('[data-endpoint="route"]').value =
        JSON.stringify(getRouteBody(), null, 2);
    }

    function renderPointCards() {
      const el = document.getElementById("routePoints");
      if (!waypoints.length) {
        el.innerHTML = "";
        el.style.display = "none";
      } else {
        el.style.display = "flex";
        const card = (cls, badge, title, p) =>
          '<div class="trip-card ' + cls + '"><div class="trip-badge">' + badge + '</div><div><div class="trip-title">' + title + '</div><div class="trip-name">' + (p.name || "—") + '</div></div></div>';
        el.innerHTML = waypoints.map((w, i) => card("wp", i + 1, "Stop " + (i + 1), w)).join("");
      }
      syncRouteJson();
      syncAddrInputs();
      refreshMarkers();
    }

    function refreshMarkers() {
      markerLayer.clearLayers();
      L.marker([fromPoint.lat, fromPoint.lng], { icon: fromIcon }).bindPopup("<b>From</b><br>" + (fromPoint.name || "")).addTo(markerLayer);
      waypoints.forEach((w, i) => L.marker([w.lat, w.lng], { icon: wpIcon }).bindPopup("Stop " + (i + 1)).addTo(markerLayer));
      L.marker([toPoint.lat, toPoint.lng], { icon: toIcon }).bindPopup("<b>To</b><br>" + (toPoint.name || "")).addTo(markerLayer);
    }

    function activeRouteColor() {
      return routingProfile === "motorbike" ? "#06b6d4" : "#10b981";
    }

    function syncMapLegend() {
      const activeLine = document.querySelector(".legend-line.active");
      if (activeLine) {
        activeLine.classList.toggle("cyan", routingProfile === "motorbike");
      }
    }

    function drawGeometry(geo, color, animate) {
      drawAllRoutes([{ geometry: geo }], 0, color || activeRouteColor(), animate !== false);
    }

    function drawAllRoutes(routes, activeIdx, activeColor, animate) {
      clearRoute();
      if (!routes?.length) return;
      const bounds = [];
      const activeColorUsed = activeColor || activeRouteColor();
      const shouldAnimate = animate !== false;
      const lineBase = { lineCap: "round", lineJoin: "round", interactive: false };

      routes.forEach((r, i) => {
        const geo = r.geometry;
        if (!geo || geo.type !== "LineString") return;
        const latlngs = geo.coordinates.map(c => [c[1], c[0]]);
        latlngs.forEach(ll => bounds.push(ll));
        const active = i === activeIdx;

        if (!active) {
          const altTrack = L.polyline(latlngs, {
            ...lineBase,
            color: "#475569",
            weight: 4,
            opacity: 0.28,
          }).addTo(routeLayer);
          const alt = L.polyline(latlngs, {
            ...lineBase,
            color: "#94a3b8",
            weight: 3,
            opacity: 0.5,
            dashArray: shouldAnimate ? undefined : "8 10",
            className: shouldAnimate ? "" : "route-stream-alt",
          }).addTo(routeLayer);
          if (shouldAnimate) {
            afterPathReady(alt, el => animatePathEl(el, "alt-draw"));
          }
        } else {
          const color = activeColorUsed;

          L.polyline(latlngs, {
            ...lineBase,
            color: "#0f172a",
            weight: 13,
            opacity: 0.65,
          }).addTo(routeLayer);

          L.polyline(latlngs, {
            ...lineBase,
            color,
            weight: 8,
            opacity: 0.18,
          }).addTo(routeLayer);

          const main = L.polyline(latlngs, {
            ...lineBase,
            color,
            weight: 5,
            opacity: 0.92,
          }).addTo(routeLayer);

          addDataStreams(latlngs, routingProfile);

          if (shouldAnimate) {
            afterPathReady(main, el => animatePathEl(el, "active-draw"));
          } else {
            afterPathReady(main, el => {
              el.classList.add("route-core-live");
              el.setAttribute("filter", streamPalette(routingProfile).neon);
            });
          }
        }
      });

      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48] });
      syncMapLegend();
    }

    function renderRouteOptions(routes, activeIdx) {
      const panel = document.getElementById("routeOptionsPanel");
      const list = document.getElementById("routeOptionsList");
      const legend = document.getElementById("mapLegend");
      if (!routes || routes.length <= 1) {
        panel.style.display = "none";
        legend.style.display = "none";
        list.innerHTML = "";
        return;
      }
      panel.style.display = "block";
      legend.style.display = "flex";
      list.innerHTML = routes.map((r, i) => {
        const showDur = shouldShowDuration(cachedDurationMeta, r.duration);
        const durHtml = showDur
          ? '<strong class="duration visible">' + fmtDur(r.duration) + "</strong>"
          : "";
        const durNote = showDur
          ? '<div class="route-opt-duration-note visible">' + DURATION_DISCLAIMER + "</div>"
          : "";
        return (
          '<div class="route-opt' + (i === activeIdx ? " active" : "") + '" data-idx="' + i + '">' +
          '<div class="route-opt-head"><span>' + (i === 0 ? ico("star", "ico-xs") + " Tối ưu" : "Phương án " + (i + 1)) + "</span>" + durHtml + "</div>" +
          '<div class="route-opt-meta"><span class="route-dist">' + fmtDist(r.distance) + "</span></div>" +
          durNote + "</div>"
        );
      }).join("");
      list.querySelectorAll(".route-opt").forEach(el => {
        el.onclick = () => selectRouteOption(Number(el.dataset.idx));
      });
    }

    function selectRouteOption(idx) {
      activeRouteIndex = idx;
      const r = cachedRouteOptions[idx];
      if (!r) return;
      drawAllRoutes(cachedRouteOptions, idx, undefined, false);
      setStats(r.distance, r.duration, cachedRouteOptions.length, cachedDurationMeta);
      renderRouteOptions(cachedRouteOptions, idx);
      renderRouteSummary(r, cachedRouteOptions.length);
    }

    function durationSummaryHtml(route, meta) {
      if (!shouldShowDuration(meta, route?.duration)) return "";
      return (
        '<div class="summary-row">Thời gian: <strong>' + fmtDur(route.duration) + "</strong>" +
        '<br><span style="font-size:.68rem;color:var(--dim)">' + DURATION_DISCLAIMER + "</span></div>"
      );
    }

    function renderRouteSummary(route, totalRoutes) {
      const el = document.getElementById("viewSummary");
      const label = route.recommended ? "Tuyến tối ưu" : "Tuyến thay thế";
      el.innerHTML =
        '<div class="summary-row"><strong>' + label + "</strong>" +
        (totalRoutes > 1 ? " · " + totalRoutes + " phương án" : "") + "</div>" +
        '<div class="summary-row">Phương tiện: <strong>' + (PROFILE_LABELS[routingProfile] || routingProfile) + "</strong></div>" +
        '<div class="summary-row">' + (route.summary || "Driving route") + "</div>" +
        '<div class="summary-row">Quãng đường: <strong>' + fmtDist(route.distance) + "</strong></div>" +
        durationSummaryHtml(route, cachedDurationMeta);
    }

    function handleRouteResponse(d) {
      prefetchedRouteKey = routeBodyKey(getRouteBody());
      prefetchedRouteData = d;
      cachedDurationMeta = d.durationMeta || null;
      hasRoutedOnce = true;
      cachedRouteOptions = d.routes?.length ? d.routes : [{
        recommended: true,
        distance: d.distance,
        duration: d.duration ?? null,
        durationOsrm: d.durationOsrm ?? null,
        geometry: d.geometry,
        weight: d.weight,
        summary: d.summary,
      }];
      activeRouteIndex = 0;
      drawAllRoutes(cachedRouteOptions, 0, undefined, true);
      setStats(d.distance, d.duration, cachedRouteOptions.length, cachedDurationMeta);
      renderRouteOptions(cachedRouteOptions, 0);
      renderRouteSummary(cachedRouteOptions[0], cachedRouteOptions.length);
    }

    function clearRoute() { routeLayer.clearLayers(); }

    function setStats(dist, dur, routeCount, meta) {
      document.getElementById("statDistance").textContent = fmtDist(dist);
      document.getElementById("statRoutes").textContent = routeCount != null ? String(routeCount) : "—";
      document.getElementById("statVehicle").textContent =
        hasRoutedOnce ? (PROFILE_LABELS[routingProfile] || routingProfile) : "—";

      const showDuration = shouldShowDuration(meta, dur);
      const durWrap = document.getElementById("metricDuration");
      const durDivider = document.getElementById("metricDividerDuration");
      durWrap.classList.toggle("visible", showDuration);
      durDivider.style.display = showDuration ? "" : "none";
      if (showDuration) {
        document.getElementById("statDuration").textContent = fmtDur(dur);
      }
    }

    function setOutTab(name) {
      document.querySelectorAll(".out-tab").forEach(t => t.classList.toggle("active", t.dataset.out === name));
      document.getElementById("viewSummary").style.display = name === "summary" ? "block" : "none";
      document.getElementById("viewJson").style.display = name === "json" ? "block" : "none";
      document.getElementById("viewMatrix").style.display = name === "matrix" ? "block" : "none";
    }

    function renderSummary(data, endpoint) {
      const el = document.getElementById("viewSummary");
      if (!data) { el.innerHTML = "No data."; return; }
      if (data.geometry || data.routes?.length) {
        if (data.routes?.length) {
          renderRouteSummary(data.routes[activeRouteIndex] || data.routes[0], data.routes.length);
        } else {
          el.innerHTML =
            '<div class="summary-row"><strong>Route</strong><br>' + (data.summary || "Driving route") + '</div>' +
            '<div class="summary-row">Quãng đường: <strong>' + fmtDist(data.distance) + '</strong></div>' +
            (shouldShowDuration(data.durationMeta, data.duration)
              ? '<div class="summary-row">Thời gian: <strong>' + fmtDur(data.duration) + '</strong><br><span style="font-size:.68rem;color:var(--dim)">' + DURATION_DISCLAIMER + "</span></div>"
              : "") +
            '<div class="summary-row">Legs: <strong>' + (data.legs?.length || 0) + '</strong></div>';
        }
        return;
      }
      if (data.trips?.[0]) {
        const t = data.trips[0];
        el.innerHTML =
          '<div class="summary-row"><strong>Trip optimized</strong></div>' +
          '<div class="summary-row">Quãng đường: <strong>' + fmtDist(t.distance) + '</strong></div>' +
          (shouldShowDuration(null, t.duration)
            ? '<div class="summary-row">Thời gian: <strong>' + fmtDur(t.duration) + '</strong><br><span style="font-size:.68rem;color:var(--dim)">' + DURATION_DISCLAIMER + "</span></div>"
            : "");
        return;
      }
      if (data.matchings?.[0]) {
        const m = data.matchings[0];
        el.innerHTML =
          '<div class="summary-row"><strong>Map matched</strong></div>' +
          '<div class="summary-row">Confidence: <strong>' + Math.round((m.confidence || 0) * 100) + '%</strong></div>' +
          '<div class="summary-row">Distance: <strong>' + fmtDist(m.distance) + '</strong></div>';
        return;
      }
      if (data.waypoint) {
        el.innerHTML =
          '<div class="summary-row"><strong>Nearest road</strong></div>' +
          '<div class="summary-row">' + (data.waypoint.name || "Unnamed") + '</div>' +
          '<div class="summary-row">Snap distance: <strong>' + fmtDist(data.waypoint.distance) + '</strong></div>';
        return;
      }
      if (data.distances) {
        el.innerHTML = '<div class="summary-row"><strong>Distance matrix</strong> — xem tab Matrix</div>';
        setOutTab("matrix");
        return;
      }
      el.innerHTML = "<pre style='font-size:.72rem;color:var(--muted)'>" + JSON.stringify(data, null, 2) + "</pre>";
    }

    function renderMatrix(data) {
      const el = document.getElementById("viewMatrix");
      if (!data?.durations) { el.innerHTML = ""; return; }
      let html = '<table class="matrix-table"><tr><th></th>';
      data.durations[0].forEach((_, j) => { html += "<th>Dest " + (j + 1) + "</th>"; });
      html += "</tr>";
      data.durations.forEach((row, i) => {
        html += "<tr><th>Src " + (i + 1) + "</th>";
        row.forEach((dur, j) => {
          const durHtml = shouldShowDuration(null, dur) ? "<small>" + durationLabel(dur) + "</small>" : "";
          html += "<td>" + fmtDist(data.distances[i][j]) + durHtml + "</td>";
        });
        html += "</tr>";
      });
      html += "</table>";
      el.innerHTML = html;
    }

    Object.keys(samples).forEach(k => {
      const ta = document.querySelector('[data-endpoint="' + k + '"]');
      if (ta) ta.value = JSON.stringify(samples[k], null, 2);
    });
    renderPointCards();

    document.querySelectorAll(".seg-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".seg-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".api-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.querySelector('[data-panel="' + tab.dataset.tab + '"]').classList.add("active");
      });
    });

    document.querySelectorAll(".out-tab").forEach(tab => {
      tab.addEventListener("click", () => setOutTab(tab.dataset.out));
    });

    document.getElementById("alternativesToggle").addEventListener("change", (e) => {
      alternativesEnabled = e.target.checked;
      syncRouteJson();
      invalidatePrefetch();
      if (hasRoutedOnce) runRouteFromPoints();
    });

    document.getElementById("streamFxToggle").addEventListener("change", (e) => {
      streamEffectsEnabled = e.target.checked;
      localStorage.setItem("routeFx", streamEffectsEnabled ? "on" : "off");
      document.body.classList.toggle("reduce-motion", !streamEffectsEnabled);
      if (hasRoutedOnce && cachedRouteOptions.length) {
        drawAllRoutes(cachedRouteOptions, activeRouteIndex, undefined, false);
      }
    });

    document.querySelectorAll("[data-profile]").forEach(btn => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.profile;
        if (!next || next === routingProfile) return;
        routingProfile = next;
        document.querySelectorAll("[data-profile]").forEach(b => {
          b.classList.toggle("active", b.dataset.profile === routingProfile);
        });
        syncRouteJson();
        invalidatePrefetch();
        document.getElementById("statVehicle").textContent = PROFILE_LABELS[routingProfile] || routingProfile;
        syncMapLegend();
        toast(PROFILE_LABELS[routingProfile] || routingProfile);
        if (hasRoutedOnce) runRouteFromPoints();
      });
    });

    function loadRecentSearches() {
      try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      } catch {
        return [];
      }
    }

    function pushRecentSearch(q) {
      const trimmed = q.trim();
      if (trimmed.length < 3) return;
      const items = loadRecentSearches().filter(x => x !== trimmed);
      items.unshift(trimmed);
      localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
      renderRecentSearches();
    }

    function renderRecentSearches() {
      const wrap = document.getElementById("recentSearchesWrap");
      const list = document.getElementById("recentSearchesList");
      const items = loadRecentSearches();
      if (!items.length) {
        wrap.classList.add("hidden");
        list.innerHTML = "";
        return;
      }
      wrap.classList.remove("hidden");
      list.innerHTML = items.map(q =>
        '<button type="button" class="recent-chip" data-q="' + q.replace(/"/g, "&quot;") + '">' + q + "</button>"
      ).join("");
      list.querySelectorAll(".recent-chip").forEach(el => {
        el.onclick = () => {
          toInput.value = el.dataset.q;
          geocodeField(toInput, document.getElementById("toResults"), applyToResult, { pickFirst: true });
        };
      });
    }

    renderRecentSearches();

    async function fetchGeocode(q, limit) {
      const wait = Math.max(0, GEOCODE_MIN_INTERVAL_MS - (Date.now() - lastGeocodeAt));
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      lastGeocodeAt = Date.now();
      activeGeocodeQuery = q;
      const params = new URLSearchParams({
        q,
        limit: String(limit || 6),
        lat: String(searchBias.lat),
        lng: String(searchBias.lng),
      });
      const res = await fetch("/api/geocode?" + params.toString());
      const data = await res.json();
      if (res.status === 429) {
        throw new Error("Rate limit 429 — đợi ~60 giây rồi thử lại (public OSM max 1 req/s)");
      }
      if (!data.success) throw new Error(data.message || "Geocode failed");
      return data.data.results;
    }

    function renderGeocodeResults(box, results, onPick) {
      if (!results.length) {
        box.innerHTML = '<div class="result-item">Không tìm thấy địa chỉ</div>';
        return;
      }
      box.innerHTML = results.map((r, i) => {
        const nearBadge = r.distanceKm != null && r.distanceKm <= NEAR_KM
          ? '<span class="result-near-badge">Gần bạn</span>' : "";
        return (
          '<div class="result-item" data-i="' + i + '">' +
          '<div class="result-item-head"><span>' + r.displayName + "</span>" + nearBadge + "</div>" +
          "<small>" + r.lat.toFixed(5) + ", " + r.lng.toFixed(5) + "</small></div>"
        );
      }).join("");
      box._results = results;
      box.querySelectorAll(".result-item").forEach(el => {
        el.onclick = () => {
          const r = box._results[Number(el.dataset.i)];
          onPick(r);
          box.innerHTML = "";
        };
      });
    }

    function applyFromResult(r) {
      fromPoint = { lat: r.lat, lng: r.lng, name: r.displayName };
      fromInput.value = r.displayName;
      renderPointCards();
      invalidatePrefetch();
      prefetchRoute();
    }

    function applyToResult(r) {
      toPoint = { lat: r.lat, lng: r.lng, name: r.displayName };
      toInput.value = r.displayName;
      renderPointCards();
      pushRecentSearch(r.displayName);
      invalidatePrefetch();
      prefetchRoute();
    }

    async function geocodeField(inputEl, boxEl, applyFn, opts) {
      const q = inputEl.value.trim();
      if (!q) return null;
      boxEl.innerHTML = '<div class="result-item">Searching…</div>';
      try {
        const results = await fetchGeocode(q, opts?.limit || 6);
        if (activeGeocodeQuery !== q) return null;
        if (opts?.pickFirst) {
          if (!results[0]) {
            boxEl.innerHTML = '<div class="result-item">Không tìm thấy địa chỉ</div>';
            return null;
          }
          applyFn(results[0]);
          boxEl.innerHTML = "";
          return results[0];
        }
        renderGeocodeResults(boxEl, results, applyFn);
        return results;
      } catch (err) {
        if (activeGeocodeQuery === q) {
          boxEl.innerHTML = '<div class="result-item">' + err.message + "</div>";
        }
        return null;
      }
    }

    function scheduleGeocode(inputEl, boxEl, applyFn) {
      clearTimeout(geocodeTimer);
      const q = inputEl.value.trim();
      if (q.length < 3) { boxEl.innerHTML = ""; return; }
      geocodeTimer = setTimeout(() => geocodeField(inputEl, boxEl, applyFn), GEOCODE_DEBOUNCE_MS);
    }

    fromInput.addEventListener("input", () => scheduleGeocode(fromInput, document.getElementById("fromResults"), applyFromResult));
    toInput.addEventListener("input", () => scheduleGeocode(toInput, document.getElementById("toResults"), applyToResult));

    fromInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        geocodeField(fromInput, document.getElementById("fromResults"), applyFromResult, { pickFirst: true })
          .then(() => toInput.focus());
      }
    });
    toInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        geocodeField(toInput, document.getElementById("toResults"), applyToResult, { pickFirst: true })
          .then(() => runRouteFromPoints());
      }
    });

    document.getElementById("swapAddrBtn").onclick = () => {
      const tmp = fromPoint;
      fromPoint = toPoint;
      toPoint = tmp;
      renderPointCards();
      invalidatePrefetch();
      prefetchRoute();
      toast("Đã đổi From ↔ To");
    };

    document.getElementById("useCurrentLocationBtn").onclick = async () => {
      const btn = document.getElementById("useCurrentLocationBtn");
      if (!navigator.geolocation) {
        toast("Trình duyệt không hỗ trợ GPS");
        return;
      }
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            userGps = { lat, lng };
            searchBias = { lat, lng, source: "gps" };
            setUserLocationMarker(lat, lng);
            updateGeoPill();
            map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
            const res = await fetch("/api/reverse-geocode?lat=" + lat + "&lng=" + lng);
            const json = await res.json();
            if (json.success && json.data) {
              applyFromResult(json.data);
              toast("Đã đặt From tại vị trí hiện tại");
            } else {
              applyFromResult({
                lat,
                lng,
                displayName: lat.toFixed(5) + ", " + lng.toFixed(5),
              });
              toast("Đã lấy GPS — không reverse được địa chỉ");
            }
          } catch (err) {
            toast(err.message || "Không lấy được vị trí");
          }
          btn.disabled = false;
        },
        () => {
          toast("Không lấy được GPS — kiểm tra quyền truy cập");
          btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    };

    async function resolvePoint(inputEl, boxEl, applyFn, current) {
      const q = inputEl.value.trim();
      if (!q) throw new Error("Nhập địa chỉ From và To");
      if (current.name && current.name === q) return current;
      const r = await geocodeField(inputEl, boxEl, applyFn, { pickFirst: true, limit: 1 });
      if (!r) throw new Error("Không tìm thấy: " + q);
      return { lat: r.lat, lng: r.lng, name: r.displayName };
    }

    async function runRouteFromPoints() {
      const btn = document.getElementById("routeByAddrBtn");
      btn.disabled = true;
      try {
        await resolvePoint(fromInput, document.getElementById("fromResults"), applyFromResult, fromPoint);
        await resolvePoint(toInput, document.getElementById("toResults"), applyToResult, toPoint);
        if (applyPrefetchedRouteIfReady()) {
          toast("Tuyến từ cache · prefetch");
          btn.disabled = false;
          return;
        }
        await sendRequest("route", "/api/route", null);
      } catch (err) {
        toast(err.message);
      }
      btn.disabled = false;
    }

    document.getElementById("routeByAddrBtn").onclick = runRouteFromPoints;

    const statusBadge = document.getElementById("statusBadge");
    const timingEl = document.getElementById("timing");
    const mapLoader = document.getElementById("mapLoader");

    function setStatus(code, ms) {
      statusBadge.textContent = code ? "HTTP " + code : "—";
      statusBadge.className = "http-badge " + (code >= 200 && code < 300 ? "ok" : code ? "fail" : "pending");
      timingEl.textContent = ms != null ? ms + " ms" : "";
    }

    async function sendRequest(endpoint, path, btn) {
      const textarea = document.querySelector('[data-endpoint="' + endpoint + '"]');
      if (endpoint === "route") syncRouteJson();
      if (btn) btn.disabled = true;
      clearRoute();
      mapLoader.classList.add("show");
      setStatus(null, null);

      let body;
      try {
        body = JSON.parse(textarea.value);
      } catch (e) {
        document.getElementById("viewJson").textContent = "Invalid JSON: " + e.message;
        setOutTab("json");
        if (btn) btn.disabled = false;
        mapLoader.classList.remove("show");
        return;
      }

      const start = performance.now();
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const ms = Math.round(performance.now() - start);
        setStatus(res.status, ms);
        const json = await res.json();
        lastJson = json;
        document.getElementById("viewJson").textContent = JSON.stringify(json, null, 2);

        if (json.success && json.data) {
          const d = json.data;
          setOutTab("summary");
          if (endpoint === "route" && (d.routes?.length || d.geometry)) {
            handleRouteResponse(d);
          } else {
            renderSummary(d, endpoint);
            if (d.trips?.[0]) {
            drawGeometry(d.trips[0].geometry, "#8b5cf6", true);
            setStats(d.trips[0].distance, d.trips[0].duration, 1, { available: hasDuration(d.trips[0].duration) });
          } else if (d.matchings?.[0]) {
            drawGeometry(d.matchings[0].geometry, "#f59e0b", true);
            setStats(d.matchings[0].distance, d.matchings[0].duration, 1, { available: hasDuration(d.matchings[0].duration) });
          } else if (d.waypoint) {
            const loc = d.waypoint.location;
            L.marker([loc[1], loc[0]], { icon: wpIcon }).addTo(routeLayer);
            map.setView([loc[1], loc[0]], 16);
            setStats(d.waypoint.distance, null, 0, { available: false });
          } else if (d.distances) {
            renderMatrix(d);
            setStats(null, null, null, { available: false });
          }
          }
          toast("Request OK · " + ms + "ms");
        } else {
          setStats(null, null, null, { available: false });
          setOutTab("json");
          toast(json.message || "Request failed");
        }
      } catch (e) {
        setStatus(0, Math.round(performance.now() - start));
        document.getElementById("viewJson").textContent = "Network error: " + e.message;
        setOutTab("json");
        toast("Network error");
      }
      if (btn) btn.disabled = false;
      mapLoader.classList.remove("show");
    }

    document.querySelectorAll(".send").forEach(btn => {
      btn.onclick = () => sendRequest(btn.dataset.endpoint, btn.dataset.path, btn);
    });

    document.querySelectorAll(".reset").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.endpoint;
        document.querySelector('[data-endpoint="' + id + '"]').value = JSON.stringify(samples[id], null, 2);
        toast("Reset " + id);
      };
    });

    document.getElementById("copyBtn").onclick = () => {
      const text = document.getElementById("viewJson").textContent;
      navigator.clipboard.writeText(text).then(() => toast("Copied JSON"));
    };

    function setPill(id, ok, label) {
      document.getElementById(id + "Dot").className = "dot " + (ok ? "ok" : "err");
      document.getElementById(id + "Text").textContent = label;
    }

    fetch("/health").then(r => r.json()).then(d => setPill("health", d.success, d.success ? "API ok" : "API err"));
    fetch("/api/osrm-status").then(r => r.json()).then(d => setPill("osrm", d.osrm === "ok", d.osrm === "ok" ? "OSRM ok" : "OSRM down"));
    fetch("/api/geocode-status").then(r => r.json()).then(d => {
      setPill("geo", d.nominatim === "ok", d.nominatim === "ok" ? "Geo ok" : "Geo down");
      if (!d.success) document.getElementById("geoText").title = d.message || "";
    });

    const streamFxToggle = document.getElementById("streamFxToggle");
    if (streamFxToggle) streamFxToggle.checked = streamEffectsEnabled;

    setTimeout(() => sendRequest("route", "/api/route", null), 500);
  </script>
</body>
</html>`;
}
