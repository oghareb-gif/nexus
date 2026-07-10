/* ============================================================================
   NEXUS CLINIC — Tiny SVG charts (zero dependencies)

   Each function returns an SVG string you can drop straight into innerHTML.
   Colours come from the site's CSS variables so charts always stay on-brand.
   ========================================================================== */

(function () {
  const LIME = "var(--lime)";
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const fmt = (n) => Number(n).toLocaleString("en-US");

  /* Vertical bar chart.
     data: [{ label, value }]   opts: { height, unit, accent } */
  function bars(data, opts = {}) {
    const W = 100, H = opts.height || 46; // viewBox units (responsive)
    const pad = 2;
    const n = data.length || 1;
    const gap = 1.6;
    const bw = (W - pad * 2 - gap * (n - 1)) / n;
    const max = Math.max(1, ...data.map((d) => d.value));
    const accent = opts.accent || LIME;
    const unit = opts.unit || "";

    const rects = data
      .map((d, i) => {
        const h = Math.max(0.6, (d.value / max) * (H - 12));
        const x = pad + i * (bw + gap);
        const y = H - 8 - h;
        const title = `${esc(d.label)}: ${fmt(d.value)}${unit ? " " + unit : ""}`;
        return `
        <g>
          <title>${title}</title>
          <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}"
                rx="0.8" fill="${accent}" opacity="${i === n - 1 ? 1 : 0.55}"/>
          <text x="${(x + bw / 2).toFixed(2)}" y="${(H - 2).toFixed(2)}" text-anchor="middle"
                font-size="2.6" fill="var(--faint)" font-family="'JetBrains Mono',monospace">${esc(d.label)}</text>
        </g>`;
      })
      .join("");

    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${rects}</svg>`;
  }

  /* Smooth-ish area/line chart.
     data: [{ label, value }]   opts: { height, unit, accent } */
  function area(data, opts = {}) {
    const W = 100, H = opts.height || 46;
    const pad = 2;
    const n = data.length;
    if (!n) return "";
    const max = Math.max(1, ...data.map((d) => d.value));
    const accent = opts.accent || LIME;
    const stepX = n > 1 ? (W - pad * 2) / (n - 1) : 0;
    const y = (v) => H - 8 - (v / max) * (H - 12);
    const pts = data.map((d, i) => [pad + i * stepX, y(d.value)]);

    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
    const fill = `${line} L${pts[n - 1][0].toFixed(2)},${H - 8} L${pts[0][0].toFixed(2)},${H - 8} Z`;

    const dots = pts
      .map((p, i) => {
        const title = `${esc(data[i].label)}: ${fmt(data[i].value)}${opts.unit ? " " + opts.unit : ""}`;
        return `<g><title>${title}</title><circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="0.9" fill="${accent}"/></g>`;
      })
      .join("");

    const labels = data
      .map((d, i) => `<text x="${(pad + i * stepX).toFixed(2)}" y="${(H - 2).toFixed(2)}" text-anchor="middle" font-size="2.6" fill="var(--faint)" font-family="'JetBrains Mono',monospace">${esc(d.label)}</text>`)
      .join("");

    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
      <path d="${fill}" fill="${accent}" opacity="0.14"/>
      <path d="${line}" fill="none" stroke="${accent}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${labels}
    </svg>`;
  }

  /* Donut chart. segments: [{ label, value, color }]
     Returns { svg, legend } — svg is square, legend is HTML rows. */
  function donut(segments, opts = {}) {
    const size = 100, cx = 50, cy = 50, r = 38, sw = 16;
    const total = segments.reduce((s, x) => s + x.value, 0);
    const palette = ["var(--lime)", "var(--gold)", "var(--coral)", "#5cc8ff", "#b98cff", "#4ade80"];
    const C = 2 * Math.PI * r;
    let offset = 0;

    const arcs =
      total === 0
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="${sw}"/>`
        : segments
            .map((s, i) => {
              const frac = s.value / total;
              const len = frac * C;
              const color = s.color || palette[i % palette.length];
              const dash = `${len.toFixed(2)} ${(C - len).toFixed(2)}`;
              const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}"
                  stroke-width="${sw}" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset).toFixed(2)}"
                  transform="rotate(-90 ${cx} ${cy})"><title>${esc(s.label)}: ${fmt(s.value)}</title></circle>`;
              offset += len;
              return el;
            })
            .join("");

    const centerTop = opts.centerLabel != null ? fmt(opts.centerLabel) : fmt(total);
    const centerSub = opts.centerSub || "total";

    const svg = `<svg class="donut-svg" viewBox="0 0 ${size} ${size}" role="img">
      ${arcs}
      <text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="15" fill="var(--paper)" font-family="Anton,sans-serif">${esc(centerTop)}</text>
      <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="5" fill="var(--faint)" font-family="'JetBrains Mono',monospace" letter-spacing="0.5">${esc(centerSub).toUpperCase()}</text>
    </svg>`;

    const legend = segments
      .map((s, i) => {
        const color = s.color || palette[i % palette.length];
        const pct = total ? Math.round((s.value / total) * 100) : 0;
        return `<div class="legend-row"><span class="dot" style="background:${color}"></span>
          <span class="lg-label">${esc(s.label)}</span>
          <span class="lg-val">${fmt(s.value)} · ${pct}%</span></div>`;
      })
      .join("");

    return { svg, legend };
  }

  window.NexusCharts = { bars, area, donut };
})();
