// SVG Diagram & Sketch Generators for Overhead Line Design
// Extracted and modularized for React

export function buildSpanPlotSvg(plot) {
  if (!plot || !plot.xs || !plot.xs.length) return '';
  const W = 700, H = 260, padL = 52, padR = 20, padT = 36, padB = 42;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xs = plot.xs;
  const allY = plot.terrain.slice();
  (plot.circuits || []).forEach(c => { if (c && c.y) allY.push(...c.y); });
  allY.push(plot.elevA, plot.elevB);
  let yMin = Math.min(...allY.filter(Number.isFinite)), yMax = Math.max(...allY.filter(Number.isFinite));
  if (!(yMax > yMin)) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.1 || 0.5;
  yMin -= yPad; yMax += yPad;
  const xMax = plot.L || xs[xs.length - 1] || 1;
  const sx = (x) => padL + (x / xMax) * innerW;
  const sy = (y) => padT + innerH - ((y - yMin) / (yMax - yMin)) * innerH;
  const poly = (arr, color, fill) => {
    if (!arr || !arr.length) return '';
    const pts = arr.map((y, i) => `${sx(xs[i]).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
    if (fill) {
      const base = `${sx(xs[0]).toFixed(1)},${sy(yMin).toFixed(1)} ${pts} ${sx(xs[xs.length-1]).toFixed(1)},${sy(yMin).toFixed(1)}`;
      return `<polygon points="${base}" fill="${fill}" stroke="none" opacity="0.25"/>` +
             `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    }
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
  };
  const colors = ['#e8a33d', '#5fb98c', '#6aa6e8', '#e0654f', '#c9a0dc'];
  let circuitLines = '';
  (plot.circuits || []).forEach((c, i) => {
    if (!c || !c.y) return;
    circuitLines += poly(c.y, colors[i % colors.length], null);
  });
  // Pole location markers: terrain + each circuit height at x=0 and x=L
  let markers = '';
  const mark = (x, y, color, label) => {
    if (!Number.isFinite(y)) return '';
    const px = sx(x), py = sy(y);
    return `<circle cx="${px}" cy="${py}" r="3.5" fill="${color}" stroke="#fff" stroke-width="0.8"/>` +
      `<text x="${px + (x < xMax / 2 ? 5 : -5)}" y="${py - 6}" text-anchor="${x < xMax / 2 ? 'start' : 'end'}" fill="${color}" font-size="9" font-family="monospace">${label}</text>`;
  };
  markers += mark(0, plot.elevA, '#8b98a8', 'T ' + Number(plot.elevA).toFixed(2));
  markers += mark(xMax, plot.elevB, '#8b98a8', 'T ' + Number(plot.elevB).toFixed(2));
  (plot.poleHeightsA || []).forEach((y, i) => {
    if (y == null) return;
    const lab = (plot.circuits[i] && plot.circuits[i].label) || ('C' + (i + 1));
    markers += mark(0, y, colors[i % colors.length], lab + ' ' + Number(y).toFixed(2));
  });
  (plot.poleHeightsB || []).forEach((y, i) => {
    if (y == null) return;
    const lab = (plot.circuits[i] && plot.circuits[i].label) || ('C' + (i + 1));
    markers += mark(xMax, y, colors[i % colors.length], lab + ' ' + Number(y).toFixed(2));
  });
  // Min ground clearance callout
  let minClrAnno = '';
  if (plot.minClearance_m != null && plot.minClearance_x != null && Number.isFinite(plot.minClearance_m)) {
    const mx = plot.minClearance_x;
    // Find terrain & bottom circuit at that x from samples
    let yG = null, yC = null;
    if (plot.xs && plot.terrain) {
      let best = 0, bd = Infinity;
      plot.xs.forEach((x, i) => { const d = Math.abs(x - mx); if (d < bd) { bd = d; best = i; } });
      yG = plot.terrain[best];
      const bottom = (plot.circuits || []).filter(Boolean).pop();
      if (bottom) yC = bottom.y[best];
    }
    const px = sx(mx);
    if (yG != null && yC != null) {
      const py1 = sy(yC), py2 = sy(yG);
      minClrAnno =
        `<line x1="${px}" y1="${py1}" x2="${px}" y2="${py2}" stroke="#e0654f" stroke-width="1.5" stroke-dasharray="3,2"/>` +
        `<circle cx="${px}" cy="${(py1+py2)/2}" r="2.5" fill="#e0654f"/>` +
        `<text x="${px + 6}" y="${(py1+py2)/2 + 3}" fill="#e0654f" font-size="10" font-family="monospace" font-weight="600">` +
        `${Number(plot.minClearance_m).toFixed(2)} m @ ${Number(mx).toFixed(1)} m</text>`;
    } else {
      minClrAnno =
        `<text x="${px}" y="${padT + 12}" text-anchor="middle" fill="#e0654f" font-size="10" font-family="monospace">` +
        `Min clr ${Number(plot.minClearance_m).toFixed(2)} m @ ${Number(mx).toFixed(1)} m</text>`;
    }
  }
  // y ticks
  const nTicks = 5;
  let ticks = '';
  for (let i = 0; i <= nTicks; i++) {
    const y = yMin + (yMax - yMin) * (i / nTicks);
    const yy = sy(y);
    ticks += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#2b3542" stroke-width="0.5"/>`;
    ticks += `<text x="${padL - 6}" y="${yy + 3}" text-anchor="end" fill="#8b98a8" font-size="10" font-family="monospace">${y.toFixed(1)}</text>`;
  }
  ticks += `<text x="${padL}" y="${H - 10}" fill="#8b98a8" font-size="10" font-family="monospace">0 m</text>`;
  ticks += `<text x="${W - padR}" y="${H - 10}" text-anchor="end" fill="#8b98a8" font-size="10" font-family="monospace">${xMax.toFixed(0)} m</text>`;
  // pole vertical guides
  ticks += `<line x1="${sx(0)}" y1="${padT}" x2="${sx(0)}" y2="${padT+innerH}" stroke="#3a4555" stroke-width="1" stroke-dasharray="2,2"/>`;
  ticks += `<line x1="${sx(xMax)}" y1="${padT}" x2="${sx(xMax)}" y2="${padT+innerH}" stroke="#3a4555" stroke-width="1" stroke-dasharray="2,2"/>`;
  // Structures under the span (different colour; show height & clearance to lowest conductor)
  let structAnno = '';
  (plot.structures || []).forEach(st => {
    const px = sx(st.x);
    // Approximate structure top in plot coords: need yGnd+h at x — use terrain sample
    let yG = null;
    if (plot.terrain && plot.xs) {
      let best = 0, bd = Infinity;
      plot.xs.forEach((x, i) => { const d = Math.abs(x - st.x); if (d < bd) { bd = d; best = i; } });
      yG = plot.terrain[best];
    }
    if (yG == null) return;
    const yTop = yG + Number(st.h_top || 0);
    const pyTop = sy(yTop);
    const pyG = sy(yG);
    const okc = st.ok !== false;
    const col = okc ? '#2a9d8f' : '#c1121f';
    structAnno += `<line x1="${px}" y1="${pyG}" x2="${px}" y2="${pyTop}" stroke="${col}" stroke-width="3"/>`;
    structAnno += `<rect x="${px - 4}" y="${pyTop - 2}" width="8" height="4" fill="${col}"/>`;
    structAnno += `<text x="${px + 6}" y="${pyTop - 2}" fill="${col}" font-size="9" font-family="monospace" font-weight="600">${(st.label || 'S')} h=${Number(st.h_top).toFixed(1)} clr=${Number(st.clearance_m).toFixed(2)} m</text>`;
  });
  const legend = (plot.circuits || []).map((c, i) =>
    c ? `<span style="color:${colors[i % colors.length]};margin-right:12px">━ ${c.label || ('C'+(i+1))}</span>` : ''
  ).join('') + `<span style="color:#8b98a8;margin-right:12px">━ Terrain</span>` +
    `<span style="color:#e0654f;margin-right:12px">· Min ground clearance</span>` +
    `<span style="color:#2a9d8f;margin-right:12px">┃ Structure</span>`;
  const gOk = plot.ground_ok !== false;
  const cOk = plot.circuit_ok !== false;
  const sOk = plot.structure_ok !== false; // true when no structures or all OK
  let violBanner = '';
  if (gOk && cOk && sOk) {
    violBanner = `<div style="font-family:monospace;font-size:12px;color:#5fb98c;margin-bottom:6px;padding:6px 8px;border:1px solid #5fb98c;border-radius:4px;background:#1a3d2e">No clearance violations on this span (ground, circuit-to-circuit &amp; structures)</div>`;
  } else {
    const msgs = [];
    if (!gOk) msgs.push('Ground clearance violation' + (plot.minClearance_m != null ? ` (min ${Number(plot.minClearance_m).toFixed(2)} m vs req ${Number(plot.applicable_clearance_m||0).toFixed(2)} m)` : ''));
    if (!cOk) {
      const bad = (plot.cc_pairs || []).filter(p => !p.ok);
      bad.forEach(p => msgs.push(`Circuit-to-circuit violation ${p.fromLabel}–${p.toLabel} (min ${Number(p.clearance_m).toFixed(2)} m)`));
      if (!bad.length) msgs.push('Circuit-to-circuit clearance violation');
    }
    if (!sOk) {
      const badS = (plot.structures || []).filter(s => s.ok === false);
      badS.forEach(s => msgs.push('Structure clearance violation' +
        (s.label ? ' (' + s.label + ')' : '') +
        (s.clearance_m != null ? ` (clr ${Number(s.clearance_m).toFixed(2)} m vs req ${Number(s.applicable_m || plot.structure_applicable_m || 0).toFixed(2)} m)` : '')));
      if (!badS.length) msgs.push('Structure clearance violation');
    }
    violBanner = `<div style="font-family:monospace;font-size:12px;color:#e0654f;margin-bottom:6px;padding:6px 8px;border:1px solid #e0654f;border-radius:4px;background:#3a2230">${msgs.join('<br>')}</div>`;
  }
  return `<div class="card" style="margin-top:10px;padding:12px">
    ${violBanner}
    <div style="font-family:var(--mono);font-size:12px;color:var(--ink-dim);margin-bottom:6px">
      Sec ${plot.section} · Pole ${plot.pole_no} · Span ${xMax.toFixed(1)} m · Elev ${Number(plot.elevA).toFixed(2)} → ${Number(plot.elevB).toFixed(2)} m
      · Max terrain ${Number(plot.maxTerrain_m).toFixed(2)} m
      ${plot.minClearance_m != null ? ' · Min ground clr ' + Number(plot.minClearance_m).toFixed(2) + ' m @ ' + Number(plot.minClearance_x).toFixed(1) + ' m' : ''}
    </div>
    <div style="font-size:11px;margin-bottom:4px">${legend}</div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#141a22;border:1px solid #2b3542;border-radius:4px;max-width:100%">
      ${ticks}
      ${poly(plot.terrain, '#8b98a8', '#3a4555')}
      ${circuitLines}
      ${markers}
      ${minClrAnno}${structAnno}
    </svg>
  </div>`;
}


/** Scaled professional sketch of the pole line under the summary sheet */
/** Scaled professional sketch of the pole line under the summary sheet */

export function generateLineRouteSvg(computed, options = {}) {
  const { results, config } = computed || {};
  if (!results || !results.length) return '';

  const {
    theme = 'dark',
    settings = {},
    commonSections = [],
    lineStructureMode = 'legacy',
    conductorsList = [],
    configsList = []
  } = options;

  const sections = [];
  const secMap = {};
  results.forEach(r => {
    const s = String(r.section);
    if (!secMap[s]) { secMap[s] = []; sections.push(s); }
    secMap[s].push(r);
  });

  const W = 980;
  const rowH = 150;
  const padL = 36, padR = 36, padT = 52, padB = 48;
  const linkH = sections.length > 1 ? 44 : 0;
  const H = padT + padB + sections.length * rowH + Math.max(0, sections.length - 1) * linkH;

  // Theme-aware colors
  const isLight = theme === 'light' || theme === 'sand';
  const ink = isLight ? '#1a2332' : '#dfe6ee';
  const amber = isLight ? '#c47d12' : '#e8a33d';
  const danger = isLight ? '#c44735' : '#e0654f';
  const ok = isLight ? '#2a8f5c' : '#5fb98c';
  const lineCol = isLight ? '#5a6a7e' : '#8b98a8';
  const panel2 = isLight ? '#f4f6f9' : '#1c2530';
  const sectionCol = '#a78bfa';

  const cfg = config || {};
  const cfgLabel = (cfg.config_no || '') + ' — ' + (cfg.description || '');

  const esc = (t) => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${W} ${H}" style="background:${panel2};border:1px solid rgba(128,128,128,0.2);border-radius:6px;max-width:100%">`;
  svg += `<text x="${padL}" y="18" fill="${amber}" font-family="monospace" font-size="12" font-weight="600">Line Route Alignment Sketch</text>`;

  let cfgSketch = cfgLabel;
  if (lineStructureMode === 'common' && commonSections && commonSections.length) {
    cfgSketch = commonSections.map(cs => {
      const c = configsList.find(x => String(x.config_no) === String(cs.config_no));
      return 'S' + cs.no + ' P' + cs.start_pole + '-' + cs.end_pole + ':' + (c ? (c.config_no + ' ' + (c.description || '').slice(0, 24)) : cs.config_no);
    }).join(' | ');
  }
  svg += `<text x="${padL}" y="34" fill="${lineCol}" font-family="monospace" font-size="9.5">Config: ${esc(cfgSketch).slice(0, 150)}</text>`;

  const sectionEndPts = {};
  const sectionStartPts = {};
  const sectionDir = {};

  sections.forEach((s, si) => {
    const poles = secMap[s];
    const yBase = padT + si * (rowH + linkH) + 50;
    const ltr = (si % 2 === 0);
    sectionDir[s] = ltr ? 1 : -1;
    let totalLen = 0;
    for (let i = 0; i < poles.length - 1; i++) totalLen += Math.max(Number(poles[i].fore) || 0, 1);
    if (totalLen <= 0) totalLen = Math.max(poles.length - 1, 1) * 30;
    const usable = W - padL - padR;

    const xsGeo = [];
    let run = 0;
    poles.forEach((p, i) => {
      xsGeo.push(padL + (run / totalLen) * usable);
      if (i < poles.length - 1) run += Math.max(Number(p.fore) || 0, 1);
    });

    const xs = ltr ? xsGeo : xsGeo.map(x => (padL + usable) - (x - padL));
    sectionStartPts[s] = { x: xs[0], y: yBase };
    sectionEndPts[s] = { x: xs[xs.length - 1], y: yBase };

    const dirLabel = ltr ? '→ LTR' : '← RTL';
    svg += `<text x="${ltr ? padL : (W - padR)}" y="${yBase - 36}" text-anchor="${ltr ? 'start' : 'end'}" fill="${amber}" font-family="monospace" font-size="11" font-weight="600">Section ${esc(s)} ${dirLabel}</text>`;
    if (xs.length >= 2) {
      svg += `<line x1="${xs[0]}" y1="${yBase}" x2="${xs[xs.length-1]}" y2="${yBase}" stroke="${lineCol}" stroke-width="2"/>`;
    }

    poles.forEach((p, i) => {
      const x = xs[i];
      const isTerm = !!p.is_terminal;
      const isSec = !!p.is_section;
      const col = isTerm ? danger : (isSec ? sectionCol : ink);
      const ph = isTerm || isSec ? 24 : 16;
      const fd = p.foundation || {};
      const fType = fd.foundation_type || '';

      // Pole vertical shaft
      svg += `<line x1="${x}" y1="${yBase}" x2="${x}" y2="${yBase - ph}" stroke="${col}" stroke-width="${isTerm || isSec ? 3 : 2}"/>`;
      svg += `<circle cx="${x}" cy="${yBase - ph}" r="${isTerm || isSec ? 4 : 3}" fill="${col}"/>`;

      // Guy wire graphic representation
      const isGuyed = (p.guy_load_daN > 0 || (p.recommended && String(p.recommended).includes('/')) || (p.guy_arr_label && p.guy_arr_label !== 'none'));
      if (isGuyed) {
        const guySide = (i === 0) ? -1 : 1;
        const gx = x + guySide * 18;
        const gy = yBase;
        svg += `<line x1="${x}" y1="${yBase - ph}" x2="${gx}" y2="${gy}" stroke="${amber}" stroke-width="1.2" stroke-dasharray="3,2"/>`;
        svg += `<line x1="${gx-3}" y1="${gy}" x2="${gx+3}" y2="${gy}" stroke="${amber}" stroke-width="2"/>`;
      }

      // Pole label and metadata
      svg += `<text x="${x}" y="${yBase + 14}" text-anchor="middle" fill="${ink}" font-family="monospace" font-size="10" font-weight="700">P${p.pole_no}</text>`;
      if (p.angle > 0) {
        svg += `<text x="${x}" y="${yBase + 25}" text-anchor="middle" fill="${amber}" font-family="monospace" font-size="8.5">${p.angle}°</text>`;
      }
      svg += `<text x="${x}" y="${yBase - ph - 6}" text-anchor="middle" fill="${col}" font-family="monospace" font-size="8" font-weight="600">${esc(p.recommended || '')}</text>`;

      if (fType) {
        svg += `<text x="${x}" y="${yBase + 36}" text-anchor="middle" fill="${lineCol}" font-family="monospace" font-size="8">Fnd ${fType}</text>`;
      }

      // Span distance between poles
      if (i < poles.length - 1) {
        const nextX = xs[i + 1];
        const midX = (x + nextX) / 2;
        const spanL = p.fore || 0;
        svg += `<text x="${midX}" y="${yBase - 6}" text-anchor="middle" fill="${lineCol}" font-family="monospace" font-size="8.5">${spanL}m</text>`;
      }
    });
  });

  // Vertical connectors between consecutive sections
  for (let si = 0; si < sections.length - 1; si++) {
    const sCurr = sections[si];
    const sNext = sections[si + 1];
    const pt1 = sectionEndPts[sCurr];
    const pt2 = sectionStartPts[sNext];
    if (pt1 && pt2) {
      svg += `<path d="M ${pt1.x} ${pt1.y} C ${pt1.x} ${(pt1.y+pt2.y)/2}, ${pt2.x} ${(pt1.y+pt2.y)/2}, ${pt2.x} ${pt2.y}" fill="none" stroke="${amber}" stroke-width="1.5" stroke-dasharray="4,3"/>`;
    }
  }

  svg += '</svg>';
  return svg;
}
