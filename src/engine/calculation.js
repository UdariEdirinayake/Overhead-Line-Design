// LECO Overhead Line Design & Pole Selection Engine
// Extracted and modularized from verified engineering tool

import { CSV } from './csv.js';

export const Calc = (() => {
  function num(v, fallback = null) {
    if (v === undefined || v === null || v === '') return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function isMissing(v) {
    if (v === undefined || v === null || v === '') return true;
    return !Number.isFinite(parseFloat(v));
  }
  function toRad(deg) { return deg * Math.PI / 180; }

  function nCond(config, band) {
    const explicit = num(config['n_cond_' + band]);
    if (explicit != null) return explicit;
    const levels = num(config['levels_' + (band === 'HH' ? 'HH' : band === 'H' ? 'H' : 'L')], 0);
    if (!levels) return 0;
    if (band === 'L') return levels;
    return levels === 1 ? 3 : levels * 2;
  }
  function mountH(poleHeight, offsetFromTop) { return poleHeight * 5 / 6 - offsetFromTop; }

  function equivalentSpan(spans) {
    const L = spans.filter(s => s > 0);
    if (!L.length) return 0;
    const sumL = L.reduce((a, b) => a + b, 0);
    const sumL3 = L.reduce((a, b) => a + b * b * b, 0);
    return Math.sqrt(sumL3 / sumL);
  }
  function lookupTensionKN(tableRows, eqSpanM) {
    if (!tableRows || !tableRows.length) return null;
    const pts = tableRows.map(r => ({ s: num(r.span_m), t: num(r.tension_kN) }))
      .filter(p => p.s != null && p.t != null).sort((a, b) => a.s - b.s);
    if (!pts.length) return null;
    if (eqSpanM <= pts[0].s) return pts[0].t;
    if (eqSpanM >= pts[pts.length - 1].s) return pts[pts.length - 1].t;
    for (let i = 0; i < pts.length - 1; i++) {
      if (eqSpanM >= pts[i].s && eqSpanM <= pts[i + 1].s) {
        const f = (eqSpanM - pts[i].s) / (pts[i + 1].s - pts[i].s);
        return pts[i].t + f * (pts[i + 1].t - pts[i].t);
      }
    }
    return pts[pts.length - 1].t;
  }
  /** Linear interpolation of a named sag column (sag_65_m or sag_27_m) vs span_m */
  function lookupSagM(tableRows, eqSpanM, sagField) {
    if (!tableRows || !tableRows.length) return null;
    const field = sagField || 'sag_65_m';
    const pts = tableRows.map(r => ({ s: num(r.span_m), t: num(r[field]) }))
      .filter(p => p.s != null && p.t != null).sort((a, b) => a.s - b.s);
    if (!pts.length) return null;
    if (eqSpanM <= pts[0].s) return pts[0].t;
    if (eqSpanM >= pts[pts.length - 1].s) return pts[pts.length - 1].t;
    for (let i = 0; i < pts.length - 1; i++) {
      if (eqSpanM >= pts[i].s && eqSpanM <= pts[i + 1].s) {
        const f = (eqSpanM - pts[i].s) / (pts[i + 1].s - pts[i].s);
        return pts[i].t + f * (pts[i + 1].t - pts[i].t);
      }
    }
    return pts[pts.length - 1].t;
  }
  function conductorSagM(cond, eqSpanM, spanTables, sagField) {
    if (!cond) return 0;
    const tableId = (cond.lookup_table || '').trim();
    if (tableId && spanTables && spanTables.length) {
      const rows = spanTables.filter(r => String(r.table_id) === tableId);
      const s = lookupSagM(rows, eqSpanM, sagField);
      if (s != null) return s;
    }
    return 0;
  }
  /** Scale sag from equivalent span to actual span: S_act = S_eq × (L_act / L_eq)² */
  function scaleSag(sagEq, actualSpan, eqSpan) {
    if (!eqSpan || eqSpan <= 0 || sagEq == null) return 0;
    const L = Math.max(0, actualSpan || 0);
    return sagEq * (L * L) / (eqSpan * eqSpan);
  }

  /**
   * Conductor state-change equation (no wind both ends) to find T2 at t2 from T1 at t1.
   * EA α (t2−t1) + (W² g² L² EA)/(24 T1²) − T1 = (W² g² L² EA)/(24 T2²) − T2
   * Units: T in N, W kg/m, E in N/m² (from kg/mm² × 9.80665e6), A m², L m, α /°C
   * Solved by Newton–Raphson on f(T2)=0.
   */
  function stateChangeTensionN(T1_N, W_kg_m, E_N_m2, alpha, A_m2, L_m, t1, t2, W2_kg_m) {
    // Optional W2_kg_m: effective mass density in target state (e.g. wind). Default = W_kg_m.
    if (!T1_N || T1_N <= 0 || !W_kg_m || !E_N_m2 || !A_m2 || !L_m) return T1_N;
    const g = 9.81;
    const EA = E_N_m2 * A_m2;
    const W2 = (W2_kg_m != null && W2_kg_m > 0) ? W2_kg_m : W_kg_m;
    const Wg1_2 = (W_kg_m * g) * (W_kg_m * g);
    const Wg2_2 = (W2 * g) * (W2 * g);
    const K1 = (Wg1_2 * L_m * L_m * EA) / 24;
    const K2 = (Wg2_2 * L_m * L_m * EA) / 24;
    const left = EA * alpha * (t2 - t1) + K1 / (T1_N * T1_N) - T1_N;
    // f(T) = K2/T² − T − left = 0
    let T = T1_N * (t2 > t1 ? 0.85 : 1.15);
    for (let i = 0; i < 50; i++) {
      const Tsq = T * T;
      const f = K2 / Tsq - T - left;
      const df = -2 * K2 / (Tsq * T) - 1;
      const d = f / df;
      T -= d;
      if (Math.abs(d) < 1e-4) break;
      if (T < 1) T = 1;
    }
    return T;
  }

  /** Conductor E in N/m² from construction data (Modulus_of_Elasticity_kg/mm²) */
  function conductorEN(cond) {
    const E_kg_mm2 = num(cond?.['Modulus_of_Elasticity_kg/mm²'] || cond?.Modulus_of_Elasticity_kg_mm2 || cond?.modulus_kg_mm2, 0);
    return E_kg_mm2 > 0 ? E_kg_mm2 * 9.80665e6 : 0;
  }
  function conductorAlpha(cond) {
    return num(cond?.['Thermal_Expansion_Coefficient _/°C'] || cond?.['Thermal_Expansion_Coefficient_/_°C'] || cond?.thermal_expansion || cond?.alpha, 0);
  }
  function conductorUTS_daN(cond) {
    return num(cond?.Ultimate_Tensile_Strength_daN || cond?.UTS_daN || cond?.['Ultimate_Tensile_Strength_daN'], 0);
  }
  /** Effective conductor mass density under wind (kg/m): sqrt(W² + (q_c·d/g)²) */
  function conductorWeffKgM(cond, qCond_Nm2) {
    const W = num(cond?.['Weight_kg/m'] || cond?.Weight_kg_m, 0);
    const d = diaM(cond);
    const g = 9.81;
    const windNpm = (num(qCond_Nm2, 575) || 575) * d; // N/m
    return Math.sqrt(W * W + (windNpm / g) * (windNpm / g));
  }

  /**
   * Invert level-span catenary: given mid-span sag s (m), find horizontal tension H (N).
   * s = a (cosh(L/(2a)) − 1), a = H/w, w = W·g (N/m).
   */
  function horizontalTensionFromSagN(W_kg_m, L_m, sag_m) {
    if (!W_kg_m || !L_m || !sag_m || sag_m <= 0) return 0;
    const w = W_kg_m * 9.81; // N/m
    // Parabolic seed: H ≈ w L² / (8 s)
    let H = (w * L_m * L_m) / (8 * sag_m);
    for (let i = 0; i < 40; i++) {
      const a = H / w;
      if (a < 1e-6) { H = 1; break; }
      const half = L_m / (2 * a);
      // clamp cosh arg
      const ch = Math.cosh(Math.min(half, 50));
      const sCalc = a * (ch - 1);
      const dsda = (ch - 1) - half * Math.sinh(Math.min(half, 50));
      // sCalc(H): dsdH = dsda * da/dH = dsda / w
      const err = sCalc - sag_m;
      const dsdH = dsda / w;
      if (Math.abs(dsdH) < 1e-12) break;
      H -= err / dsdH;
      if (H < 1) H = 1;
      if (Math.abs(err) < 1e-5) break;
    }
    return H;
  }

  /** Creepage/allowance p for bottom (or given) band from settings */
  function creepageAllowanceM(settings, band, cond) {
    const desc = String(cond?.description || cond?.code || '').toLowerCase();
    if (band === 'HH') return num(settings.cb_creep_33, 0.3);
    if (band === 'H') return num(settings.cb_creep_11, 0.3);
    // LV
    if (/bundle|abc|aerial/.test(desc)) return num(settings.cb_creep_lvabc, 0.4);
    return num(settings.cb_creep_lvbare, 0.2);
  }
  function topAttachOffsetM(band) {
    return (band === 'L') ? 0.12 : 0.2;
  }

  /**
   * Flat-terrain max allowable sag (m) for bottom-most circuit.
   * S = q − (o + p + Σt + r), q = PH×5/6
   */
  function maxAllowableSagFlatM(poleHeight, o_m, p_m, sumT_m, r_m) {
    const q = poleHeight * 5 / 6;
    return q - (o_m + p_m + sumT_m + r_m);
  }

  /** Cross-section area from diameter (mm) → m² */
  function conductorAreaM2(cond) {
    const d_mm = num(cond?.diameter_mm, 0);
    if (!d_mm) return 0;
    const d_m = d_mm / 1000;
    return Math.PI * d_m * d_m / 4;
  }

  /**
   * Catenary for unequal-support spans (absolute elevations).
   *   Y(x) = a · cosh((x − x₀) / a) + C
   * where a = H / w, H = horizontal tension ≈ T₆₅ (N), w = W·g (N/m).
   * x₀ = horizontal location of the lowest point of the conductor.
   * Returns profile samples so sags / clearances can be inspected along the whole span.
   */
  function catenaryUnequal(cond, T65_N, L_m, elevA, elevB, attachH_A, attachH_B, surveyPts) {
    const W = num(cond?.['Weight_kg/m'] || cond?.Weight_kg_m, 0);
    const empty = {
      maxSag_m: 0, minClearance_m: attachH_A, minClearance_x: L_m / 2,
      maxTerrain_m: Math.max(elevA, elevB),
      T65_N: T65_N || 0, a: 0, x0: 0, C: 0, samples: []
    };
    if (!W || !T65_N || T65_N <= 0 || L_m <= 0) return empty;

    const w = W * 9.81;               // N per horizontal metre
    const H = T65_N;                  // horizontal component of tension at 65 °C (N)
    const a = H / w;                  // catenary parameter (m)

    // Absolute attachment elevations
    const yA = elevA + attachH_A;
    const yB = elevB + attachH_B;

    // Solve for x₀ so the curve passes through both supports:
    // yA = a·cosh(−x₀/a) + C ,  yB = a·cosh((L−x₀)/a) + C
    // → yB − yA = a [cosh((L−x₀)/a) − cosh(−x₀/a)]
    let u = 0; // u = x₀ / a
    const dY = yB - yA;
    for (let i = 0; i < 40; i++) {
      const f = a * (Math.cosh((L_m / a) - u) - Math.cosh(-u)) - dY;
      const df = a * (-Math.sinh((L_m / a) - u) + Math.sinh(-u));
      if (Math.abs(df) < 1e-14) break;
      const step = f / df;
      u -= step;
      if (Math.abs(step) < 1e-10) break;
    }
    const x0 = u * a;
    const C = yA - a * Math.cosh(-u);

    // Ground elevation at horizontal distance x from start pole.
    // At span ends (pole locations) ALWAYS use assigned pole elevations elevA / elevB
    // (overrides any survey discrepancy at the ends). Intermediate points use survey.
    // Survey h is relative to start-pole ground level (elevA).
    const sortedSurvey = (surveyPts && surveyPts.length)
      ? surveyPts.slice().filter(p => Number.isFinite(p.x) && Number.isFinite(p.h)).sort((p, q) => p.x - q.x)
      : [];
    const groundAt = (x) => {
      // Force endpoints to assigned pole elevations
      if (x <= 0) return elevA;
      if (x >= L_m) return elevB;
      if (sortedSurvey.length >= 1) {
        // Intermediate only: build list with forced ends, survey in between
        const pts = [{ x: 0, h: 0 }];
        sortedSurvey.forEach(p => {
          if (p.x > 1e-6 && p.x < L_m - 1e-6) pts.push({ x: p.x, h: p.h });
        });
        pts.push({ x: L_m, h: elevB - elevA });
        for (let i = 0; i < pts.length - 1; i++) {
          if (x >= pts[i].x && x <= pts[i + 1].x) {
            const f = (x - pts[i].x) / ((pts[i + 1].x - pts[i].x) || 1);
            return elevA + pts[i].h + f * (pts[i + 1].h - pts[i].h);
          }
        }
      }
      // Straight ground between assigned pole elevations
      return elevA + (elevB - elevA) * (x / L_m);
    };

    // Dense sampling along the span → conductor sags, ground clearance, max terrain
    // min clearance = min of (Y_cond − Y_ground) along the span (profile difference, not max-sag − max-elev)
    const nSamp = Math.max(40, Math.ceil(L_m));
    let maxSag = 0;
    let minClr = Infinity;
    let minClrX = 0;
    let maxTerrain = -Infinity;
    const samples = [];
    for (let i = 0; i <= nSamp; i++) {
      const x = (i / nSamp) * L_m;
      // Conductor absolute elevation: Y(x) = a·cosh((x−x₀)/a) + C
      const yCond = a * Math.cosh((x - x0) / a) + C;
      const yChord = yA + (yB - yA) * (x / L_m);
      const sag = yChord - yCond; // +ve when conductor is below the chord
      if (sag > maxSag) maxSag = sag;
      const yGnd = groundAt(x);
      if (yGnd > maxTerrain) maxTerrain = yGnd;
      const clr = yCond - yGnd;
      if (clr < minClr) { minClr = clr; minClrX = x; }
      samples.push({ x, yCond, yGnd, yChord, sag, clearance: clr });
    }
    if (!Number.isFinite(minClr)) {
      minClr = Math.min(attachH_A, attachH_B) - maxSag;
      minClrX = L_m / 2;
    }
    if (!Number.isFinite(maxTerrain)) maxTerrain = Math.max(elevA, elevB);

    return {
      maxSag_m: maxSag,
      minClearance_m: minClr,
      minClearance_x: minClrX,
      maxTerrain_m: maxTerrain,
      T65_N, a, x0, C, samples
    };
  }

  /** Evaluate catenary Y(x) given solved a, x0, C */
  function catenaryY(x, a, x0, C) {
    if (!a) return 0;
    return a * Math.cosh((x - x0) / a) + C;
  }

  function lookupTension27KN(cond, eqSpanM, spanTables) {
    if (!cond) return 0;
    const tableId = (cond.lookup_table || '').trim();
    if (tableId && spanTables && spanTables.length) {
      const rows = spanTables.filter(r => String(r.table_id) === tableId);
      const pts = rows.map(r => ({ s: num(r.span_m), t: num(r.tension_27_kN) }))
        .filter(p => p.s != null && p.t != null).sort((a, b) => a.s - b.s);
      if (pts.length) {
        if (eqSpanM <= pts[0].s) return pts[0].t;
        if (eqSpanM >= pts[pts.length - 1].s) return pts[pts.length - 1].t;
        for (let i = 0; i < pts.length - 1; i++) {
          if (eqSpanM >= pts[i].s && eqSpanM <= pts[i + 1].s) {
            const f = (eqSpanM - pts[i].s) / (pts[i + 1].s - pts[i].s);
            return pts[i].t + f * (pts[i + 1].t - pts[i].t);
          }
        }
        return pts[pts.length - 1].t;
      }
    }
    // fallback: approximate from everyday (often near 15–27 °C)
    return num(cond.everyday_tension_daN, 0) / 100;
  }

  function maxSpanInTable(cond, spanTables) {
    if (!cond) return null;
    const tableId = (cond.lookup_table || '').trim();
    if (!tableId || !spanTables) return null;
    const rows = spanTables.filter(r => String(r.table_id) === tableId);
    let mx = null;
    rows.forEach(r => {
      const s = num(r.span_m, null);
      if (s != null && (mx == null || s > mx)) mx = s;
    });
    return mx;
  }
  function conductorTensionKN(cond, eqSpanM, spanTables) {
    if (!cond) return 0;
    const tableId = (cond.lookup_table || '').trim();
    if (tableId && spanTables && spanTables.length) {
      const rows = spanTables.filter(r => String(r.table_id) === tableId);
      const t = lookupTensionKN(rows, eqSpanM);
      if (t != null) return t;
    }
    return num(cond.everyday_tension_daN, 0) / 100;
  }
  function diaM(cond) { return num(cond?.diameter_mm, 0) / 1000; }
  function circuitBandLabel(band) {
    if (band === 'HH') return '33kV';
    if (band === 'H') return '11kV';
    return 'LV';
  }
  /** Nominal insulator height (m) from construction data for selected description / voltage */
  function insulatorNominalHeightM(data, description, voltageKv) {
    const rows = data.insulators || [];
    if (description) {
      const hit = rows.find(r => String(r.description) === String(description));
      if (hit) return num(hit.nominal_height_m, 0) || 0;
    }
    const v = String(voltageKv).replace(/kV/i, '');
    const hit2 = rows.find(r => String(r.voltage_level_kV) === v || String(r.voltage_level_kV) === String(voltageKv));
    return hit2 ? (num(hit2.nominal_height_m, 0) || 0) : 0;
  }

  /**
   * Identify individual circuits from pole configuration N(i) pattern.
   * Rules:
   * - 11kV/33kV: a circuit comprises 3 conductors.
   *   * 2;2;2 (double vertical) → 2 circuits (Left: top+mid+bot, Right: top+mid+bot)
   *   * 3 or 3;3 or 3;3;3 → each level of 3 is one circuit
   *   * 1;2 → one circuit (top single + bottom two)
   *   * 2;4 → special double (as configured levels)
   * - LV bare: levels_L=4 with N=1 each → one LV bare circuit (4 conductors)
   * - LV bundle: levels_L=1 → one circuit per N conductors at that level
   * Returns { circuits: [{band, label, levelIndices[], nConductors}], levelToCircuitIdx: number[] }
   */
  function identifyCircuits(config) {
    const nHH = num(config.levels_HH, 0) || 0;
    const nH = num(config.levels_H, 0) || 0;
    const nL = num(config.levels_L, 0) || 0;
    const ns = String(config.n_per_level || '').split(';').map(s => num(s.trim(), 0) || 0);
    const circuits = [];
    const levelToCircuitIdx = [];
    let li = 0;
    // Helper to group HV levels
    function groupHV(band, count, startLi) {
      const levels = [];
      for (let i = 0; i < count; i++) {
        levels.push({ idx: startLi + i, n: ns[startLi + i] || 0 });
      }
      const pattern = levels.map(l => l.n).join(';');
      // Double vertical 2;2;2 → Left & Right circuits spanning all 3 levels
      if (count === 3 && pattern === '2;2;2') {
        const cL = { band, label: (band === 'HH' ? '33 kV' : '11 kV') + ' Circuit L (vertical)', levelIndices: levels.map(l => l.idx), nConductors: 3, side: 'L' };
        const cR = { band, label: (band === 'HH' ? '33 kV' : '11 kV') + ' Circuit R (vertical)', levelIndices: levels.map(l => l.idx), nConductors: 3, side: 'R' };
        const iL = circuits.length; circuits.push(cL);
        const iR = circuits.length; circuits.push(cR);
        levels.forEach(l => { levelToCircuitIdx[l.idx] = iL; }); // primary map to left; both share levels
        return;
      }
      // 1;2 single equilateral-style → one circuit
      if (count === 2 && pattern === '1;2') {
        const c = { band, label: (band === 'HH' ? '33 kV' : '11 kV') + ' Circuit 1', levelIndices: levels.map(l => l.idx), nConductors: 3 };
        const ci = circuits.length; circuits.push(c);
        levels.forEach(l => { levelToCircuitIdx[l.idx] = ci; });
        return;
      }
      // Each level with N=3 is its own circuit; other patterns: one circuit per level
      levels.forEach((l, j) => {
        const c = {
          band,
          label: (band === 'HH' ? '33 kV' : '11 kV') + ' Circuit/Stage ' + (j + 1),
          levelIndices: [l.idx],
          nConductors: l.n || (l.n === 0 ? 0 : 3)
        };
        const ci = circuits.length; circuits.push(c);
        levelToCircuitIdx[l.idx] = ci;
      });
    }
    if (nHH > 0) { groupHV('HH', nHH, li); li += nHH; }
    if (nH > 0) { groupHV('H', nH, li); li += nH; }
    // LV
    if (nL > 0) {
      const lvLevels = [];
      for (let i = 0; i < nL; i++) lvLevels.push({ idx: li + i, n: ns[li + i] || 0 });
      const allOnes = lvLevels.every(l => l.n === 1);
      if (nL === 4 && allOnes) {
        // LV bare single circuit (4 conductors)
        const c = { band: 'L', label: 'LV Bare Circuit', levelIndices: lvLevels.map(l => l.idx), nConductors: 4 };
        const ci = circuits.length; circuits.push(c);
        lvLevels.forEach(l => { levelToCircuitIdx[l.idx] = ci; });
      } else if (nL === 1) {
        const c = { band: 'L', label: 'LV Bundle Circuit', levelIndices: [lvLevels[0].idx], nConductors: lvLevels[0].n || 1 };
        const ci = circuits.length; circuits.push(c);
        levelToCircuitIdx[lvLevels[0].idx] = ci;
      } else {
        // fallback: one circuit per LV level
        lvLevels.forEach((l, j) => {
          const c = { band: 'L', label: 'LV Circuit/Stage ' + (j + 1), levelIndices: [l.idx], nConductors: l.n || 1 };
          const ci = circuits.length; circuits.push(c);
          levelToCircuitIdx[l.idx] = ci;
        });
      }
    }
    return { circuits, levelToCircuitIdx };
  }

  function stageBand(i, nHH, nH, nL) {
    if (i < nHH) return 'HH';
    if (i < nHH + nH) return 'H';
    return 'L';
  }
  function bottomMostBand(nHH, nH, nL) {
    if (nL > 0) return 'LV';
    if (nH > 0) return '11kV';
    if (nHH > 0) return '33kV';
    return 'LV';
  }
  function applicableGroundClearance(data, voltageBand, environment) {
    const rows = data.ground_clearances || [];
    const env = (environment || '').trim();
    let row = rows.find(r => String(r.voltage_band) === voltageBand && String(r.environment).trim() === env);
    if (!row) {
      // fallback: highest requirement for that band
      const bandRows = rows.filter(r => String(r.voltage_band) === voltageBand);
      if (bandRows.length) {
        bandRows.sort((a, b) => num(b.min_clearance_m, 0) - num(a.min_clearance_m, 0));
        row = bandRows[0];
      }
    }
    return row ? num(row.min_clearance_m, 0) : 0;
  }
  function circuitVerticalReq(data, upperBand, lowerBand) {
    const rows = data.circuit_clearances || [];
    const u = circuitBandLabel(upperBand === 'HH' ? 'HH' : upperBand === 'H' ? 'H' : 'L');
    const l = circuitBandLabel(lowerBand === 'HH' ? 'HH' : lowerBand === 'H' ? 'H' : 'L');
    // map HH→33kV etc already
    const uLab = upperBand === 'HH' ? '33kV' : upperBand === 'H' ? '11kV' : 'LV';
    const lLab = lowerBand === 'HH' ? '33kV' : lowerBand === 'H' ? '11kV' : 'LV';
    let row = rows.find(r => String(r.upper_band) === uLab && String(r.lower_band) === lLab);
    if (!row) row = rows.find(r => String(r.upper_band) === lLab && String(r.lower_band) === uLab);
    return row ? num(row.min_vertical_m, 0) : 0;
  }
  function structureClearanceFor(data, band) {
    const lab = band === 'HH' ? '33kV' : band === 'H' ? '11kV' : 'LV Bare';
    const rows = data.structure_clearances || [];
    let row = rows.find(r => String(r.voltage_band) === lab);
    if (!row && band === 'L') row = rows.find(r => String(r.voltage_band) === 'LV Bundle');
    return row ? num(row.min_clearance_m, 0) : 0;
  }

  function bmWindCond(n, windSpan, angleDeg, dM, hAgl, qNm2) {
    if (!n || !dM || !hAgl) return 0;
    const q = (qNm2 || 575) / 1000;
    return n * windSpan * Math.cos(toRad(angleDeg) / 2) * dM * q * hAgl;
  }
  /** BMT: (T1+T2)*sin(α/2)*N*h — T1=aft, T2=fore. When equal → 2T sin(α/2) N h */
  function bmTensionAngle(n, t1KN, t2KN, angleDeg, hAgl) {
    if (!n || !hAgl || !angleDeg) return 0;
    const t1 = t1KN || 0, t2 = (t2KN != null ? t2KN : t1KN) || 0;
    if (!t1 && !t2) return 0;
    const s = Math.sin(toRad(angleDeg) / 2);
    return (t1 * s + t2 * s) * n * hAgl;
  }
  function bmTensionFull(n, tKN, hAgl) {
    if (!n || !tKN || !hAgl) return 0;
    return n * tKN * hAgl;
  }
  function bmWindPole(poleHeight, breadthM, qPole) {
    const h = poleHeight * 5 / 6;
    const q = (qPole || 865) / 1000;
    return (breadthM || 0.28) * h * q * (h / 2);
  }
  /** BME = wind on equipment/transformer + moment due to weight (kN·m).
   *  BME = A_tf·q_p·(h_tf + B/2) + W_kg·9.810001·(1.325 − depth/2)·0.001
   *  h_tf from TFH_11m_Pole / TFH_13m_Pole depending on pole height.
   *  For terminal BM_long the weight term is subtracted (transformer opposite to conductors).
   */
  function bmEquipParts(tfRow, poleHeight, qPole) {
    if (!tfRow) return { windBm: 0, weightBm: 0, total: 0, h_tf: 0, B: 0, depth: 0, W: 0, area: 0 };
    const area = num(tfRow.area_m2, 0) || (num(tfRow.width_m, 0) * num(tfRow.height_m, 0));
    const B = num(tfRow.height_m, 0);
    const depth = num(tfRow.depth_m, 0);
    const W = num(tfRow.weight_kg, 0);
    const PH = Number(poleHeight) || 11;
    let h_tf = 0;
    if (PH >= 12.5) {
      h_tf = num(tfRow.TFH_13m_Pole ?? tfRow['TFH_13m Pole'], 0);
    } else {
      h_tf = num(tfRow.TFH_11m_Pole ?? tfRow['TFH_11m Pole'], 0);
    }
    // fallback if TFH missing: use legacy lever ≈ 6 m about GL
    if (!h_tf) h_tf = 6 - B / 2;
    const qP = (qPole || 865) / 1000;
    const windBm = area * qP * (h_tf + B / 2);
    const weightBm = W * 9.810001 * (1.325 - depth / 2) * 0.001;
    return { windBm, weightBm, total: windBm + weightBm, h_tf, B, depth, W, area };
  }
  function bmWindEquip(areaM2, qPole) {
    // legacy shim — prefer bmEquipParts
    if (!areaM2) return 0;
    return areaM2 * ((qPole || 865) / 1000) * 6;
  }
  function toPoleTop(bmKN, poleHeight) {
    const lever = poleHeight * 5 / 6 - 0.4;
    return lever > 0 ? (bmKN / lever) * 100 : 0;
  }
  /** Ensure label is "PH/capacity [suffix]" e.g. 11/500 M, 13/850 H, 11/500 U */
  function formatPoleLabel(ph, label) {
    const s = String(label || '').trim();
    if (!s || s === '—' || s === 'X' || /excessive/i.test(s)) return s;
    if (/^\d+\s*\/\s*\d+/.test(s)) {
      return s.replace(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/, function (_, h, c, rest) {
        return h + '/' + c + (rest ? ' ' + rest.trim() : '');
      });
    }
    const m = s.match(/^(2x)?\s*(\d+)\s*(.*)$/i);
    if (m) return String(ph) + '/' + (m[1] || '') + m[2] + (m[3] ? ' ' + m[3].trim() : '');
    return String(ph) + '/' + s;
  }
  /**
   * Guy tension along the guy wire (daN).
   * G = BM / (h_g · sin(α) · cos(θ)) × 100
   * α = guy angle to pole (design param), θ = guy angle to transverse (line input, default 0).
   * θ measured from transverse toward back span (+); use negative toward fore span.
   * When |θ|→90°, cosθ→0 and G→∞ (guy cannot resist transverse moment).
   */
  function guyWireLoadDaN(bmTensionKN, guyHeightM, guyAngleDeg, thetaDeg) {
    const h = guyHeightM || 8.4;
    const a = guyAngleDeg || 30;
    const th = Number(thetaDeg) || 0;
    const cosTh = Math.cos(toRad(th));
    if (Math.abs(cosTh) < 1e-6) return 1e9; // practically infinite
    const denom = h * Math.sin(toRad(a)) * cosTh;
    return denom > 0 ? (bmTensionKN / denom) * 100 : 0;
  }
  /** Longitudinal horizontal force (daN) from angled guy: Fl = G · sin(α) · sin(θ) */
  function guyLongForceDaN(guyLoadDaN, guyAngleDeg, thetaDeg) {
    const a = guyAngleDeg || 30;
    const th = Number(thetaDeg) || 0;
    return (guyLoadDaN || 0) * Math.sin(toRad(a)) * Math.sin(toRad(th));
  }

  const NOMINAL = {
    9:  [{label:'200 U',cap:200,rank:1},{label:'350 U',cap:350,rank:2},{label:'500 U',cap:500,rank:3},
         {label:'2x350 U',cap:700,rank:4},{label:'2x500 U',cap:1000,rank:5}],
    11: [{label:'200 U',cap:200,rank:1},{label:'350 U',cap:350,rank:2},{label:'500 U',cap:500,rank:3},
         {label:'850 U',cap:850,rank:4},{label:'1200 U',cap:1200,rank:5},
         {label:'2x850 U',cap:1700,rank:6},{label:'2x1200 U',cap:2400,rank:7}],
    13: [{label:'350 U',cap:350,rank:1},{label:'500 U',cap:500,rank:2},{label:'850 U',cap:850,rank:3},
         {label:'1200 U',cap:1200,rank:4},{label:'2x850 U',cap:1700,rank:5},{label:'2x1200 U',cap:2400,rank:6}]
  };
  const BUCKLING = {
    9: {'200':40,'350':70,'500':85},
    11:{'200':56.1,'350':91.0,'500':106.6,'850':157.7,'1200':228.8},
    13:{'350':85,'500':100,'850':150,'1200':210}
  };
  const BREADTH = {9:0.21, 11:0.28, 13:0.30};

  function pickUnguyed(poleHeight, loadDaN, opts) {
    const list = NOMINAL[poleHeight] || NOMINAL[11];
    // noDouble: exclude 2x (section/terminal preference). allow2x: force include 2x.
    let allow2x = true;
    if (opts && opts.allow2x === false) allow2x = false;
    if (opts && opts.noDouble) allow2x = false;
    for (const o of list) {
      if (!allow2x && /2x/i.test(String(o.label))) continue;
      if (loadDaN <= o.cap) return o;
    }
    return null;
  }
  /**
   * Strutted pole (PS.BAS 3230–3270) from pole-top load P (daN):
   *   P ≤ 745.41 → 200/200 S
   *   P ≤ 1349.74 → 200/350 S
   *   P ≤ 1601.5 → 200/500 S
   *   P ≤ 2441.83 → 200/850 S
   * else X.
   * Display associates main pole class with strut: e.g. "850 - 200/200 S".
   */
  function pickStruttedPair(loadDaN) {
    const P = Number(loadDaN) || 0;
    if (P <= 0) return null;
    if (P <= 745.41) return '200/200 S';
    if (P <= 1349.74) return '200/350 S';
    if (P <= 1601.5) return '200/500 S';
    if (P <= 2441.83) return '200/850 S';
    return null;
  }
  
  function parseFootprintMm(fp) {
    const s = String(fp || '').toLowerCase().replace(/\s/g, '');
    const m = s.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
    if (!m) return { L: 0, W: 0 };
    return { L: parseFloat(m[1]), W: parseFloat(m[2]) };
  }
  function parseBearingMin(s) {
    // "25-75" or "<25" or "300-600" or single number → conservative min kN/m²
    const t = String(s || '').trim();
    if (!t) return 0;
    if (t.startsWith('<')) return 0;
    const m = t.match(/(\d+(?:\.\d+)?)/g);
    if (!m || !m.length) return 0;
    return parseFloat(m[0]);
  }
  function findCapacityRow(capacities, poleHeight, recommended) {
    const rec = String(recommended || '');
    const h = Number(poleHeight);
    const rows = (capacities || []).filter(c => Number(c.pole_height_m) === h);
    if (!rows.length) return null;
    // strutted: "850 - 200/200 S" → match strutted mount 200/200 S
    if (/S\b/.test(rec) || /-\s*\d+\/\d+/.test(rec)) {
      const pair = (rec.match(/(\d+\/\d+\s*S)/i) || [])[1] || '';
      let r = rows.find(c => String(c.mount_type).toLowerCase() === 'strutted' && String(c.class_label).includes(pair.replace(/\s/g,'').replace(/S$/i,'') ) || String(c.class_label) === pair);
      if (!r) r = rows.find(c => String(c.mount_type).toLowerCase() === 'strutted' && String(c.class_label).replace(/\s/g,'') === pair.replace(/\s/g,''));
      if (r) return r;
    }
    // guyed: "11/350 M" or "350 M"
    const gm = rec.match(/(\d+)\s*\/\s*(\d+)\s*([LMH]|2H|\d+H)/i) || rec.match(/(\d+)\s*([LMH]|2H)/i);
    if (gm) {
      const cls = gm.length >= 4 ? (gm[2] + ' ' + gm[3]) : (gm[1] + ' ' + gm[2]);
      let r = rows.find(c => String(c.mount_type).toLowerCase() === 'guyed' && String(c.class_label).replace(/\s+/g,' ').trim() === cls.replace(/\s+/g,' ').trim());
      if (!r) {
        const base = (gm.length >= 4 ? gm[2] : gm[1]);
        const code = (gm.length >= 4 ? gm[3] : gm[2]);
        r = rows.find(c => String(c.mount_type).toLowerCase() === 'guyed' && String(c.class_label).includes(base) && String(c.class_label).includes(code));
      }
      if (r) return r;
    }
    // unguyed: "850 U" or "1200 U" or "2x850 U"
    const um = rec.match(/(2x)?\s*(\d+)\s*U/i);
    if (um) {
      const lab = ((um[1] || '') + um[2] + ' U').replace(/\s+/g, '');
      let r = rows.find(c => String(c.mount_type).toLowerCase() === 'unguyed' && String(c.class_label).replace(/\s+/g,'') === lab);
      if (!r) r = rows.find(c => String(c.class_label).replace(/\s+/g,'') === lab);
      if (r) return r;
    }
    return rows[0] || null;
  }
  function computeFoundation(opts) {
    const {
      poleHeight, recommended, isTerminal, isGuyedOrStrut,
      heights, ns, nHH, nH, nL, stageCond, stageT1, stageT2,
      windSpan, weightSpan, angleDeg, qCond, qPole,
      dHH, dH, dL, // unused if stage
      bmC_ag, bmT_ag, bmP_ag, bmE_ag, bmLong_ag, // AGL moments already computed — rebuild about fulcrum
      guyLoadDaN, guyAngleDeg, tfWeightKg, soilClass, data
    } = opts;

    const PH = Number(poleHeight) || 11;
    const P = PH / 6; // embedment
    const delta = P / Math.sqrt(2); // fulcrum depth f = L/√2

    // Rebuild moments about fulcrum
    let bmcF = 0, bmtF = 0, bmLongF = 0;
    const cosHalf = Math.cos(toRad(angleDeg) / 2);
    const sinHalf = Math.sin(toRad(angleDeg) / 2);
    const qC = (qCond || 575) / 1000;
    for (let i = 0; i < (nHH + nH + nL); i++) {
      const hi = (heights[i] || 0) + delta;
      const ni = ns[i] || 0;
      const sc = stageCond[i];
      const di = diaM(sc);
      const t1 = stageT1[i] != null ? stageT1[i] : 0;
      const t2 = stageT2[i] != null ? stageT2[i] : 0;
      bmcF += qC * di * windSpan * cosHalf * ni * hi;
      if (!isGuyedOrStrut) {
        if (!isTerminal) {
          bmtF += (t1 * sinHalf + t2 * sinHalf) * ni * hi;
          bmLongF += (t1 - t2) * cosHalf * ni * hi; // section residual longitudinal about fulcrum
        } else {
          bmLongF += ni * t2 * hi; // terminal full longitudinal
        }
      }
    }
    const Hagl = PH * 5 / 6;
    // BMp about fulcrum: use same shaft model but lever shifted
    // Original BMp = b * Hagl * qp * (Hagl/2); force = b*Hagl*qp, lever from GL = Hagl/2
    // About fulcrum lever = Hagl/2 + delta
    const qp = (qPole || 865) / 1000;
    const capRow0 = findCapacityRow(data.capacities, PH, recommended);
    const b = num(capRow0?.avg_breadth_m, 0.25);
    const forcePole = b * Hagl * qp; // kN
    const bmpF = forcePole * (Hagl / 2 + delta);
    // BME about fulcrum: reuse AGL bmE shifted by delta (approx); wind+weight already in bmE
    // BME about fulcrum using same wind+weight model as AGL, levers shifted by fulcrum depth
    const A = opts.tfArea || 0;
    const tfKeyF = opts.equipment != null && opts.equipment !== '' ? opts.equipment : (opts.tfKva != null ? opts.tfKva : opts.transformer_kva);
    const tfRowF = (typeof findEquipmentRow === 'function') ? findEquipmentRow(data.equipment || data.transformers || [], tfKeyF) : null;
    const epF = (typeof bmEquipParts === 'function') ? bmEquipParts(tfRowF || null, PH, qPole) : null;
    let bmeF;
    if (epF && (epF.area || epF.W)) {
      // wind: force = A*qp acts at (h_tf + B/2) above GL → lever about fulcrum = h_tf+B/2+delta
      // weight eccentricity: same magnitude, applied at GL plane conceptually — keep AGL value
      const windF = epF.area * qp * (epF.h_tf + epF.B / 2 + delta);
      const weightF = epF.weightBm; // eccentricity about pole axis (not about fulcrum for overturning in transverse plane the same way)
      bmeF = windF + weightF;
    } else {
      const forceEq = A * qp;
      bmeF = forceEq * (6 + delta);
    }

    let bmf = bmcF + bmpF + bmeF;
    if (!isGuyedOrStrut) {
      // Unguyed: include transverse BMT and residual longitudinal |BM_long_section| on intermediate/section;
      // terminals use full BM_long (existing).
      if (isTerminal) bmf += bmLongF;
      else bmf += bmtF + Math.abs(bmLongF);
    }

    // Mg
    const soil = (data.soil_classes || []).find(s => String(s.class) === String(soilClass)) || {};
    const k = num(
      soil['subgrade_kN/m3'] != null ? soil['subgrade_kN/m3'] :
      (soil['subgrade_MN/m3'] != null ? soil['subgrade_MN/m3'] : soil.subgrade_kNm2m), 0);
    const bGL = num(capRow0?.below_gl_breadth_m, b);
    // M_R = (k_h · B · θ / 3) · [f³ + (L − f)³],  θ = 0.01 rad
    const L_emb = P;
    const f_ful = delta; // f = L/√2
    const thetaSoil = 0.01;
    const sumCube = Math.pow(f_ful, 3) + Math.pow(Math.max(L_emb - f_ful, 0), 3);
    const Mg = (k * bGL * thetaSoil / 3) * sumCube;
    const stable = Mg > bmf;
    // Minimum below-GL breadth B such that M_R > BMF: M_R = (k·B·θ/3)·sumCube ⇒ B_min = BMF / ((k·θ/3)·sumCube)
    let B_min = null;
    if (k > 0 && sumCube > 0) {
      const denom = (k * thetaSoil / 3) * sumCube;
      if (denom > 0) B_min = bmf / denom;
    }
    const altRec = stable ? '—' : (B_min != null
      ? ('Min below-GL breadth B ≥ ' + B_min.toFixed(3) + ' m (or breast/heel block)')
      : 'Breast block / heel block or enlarge hole and concrete');

    // Vertical loads (kN)
    const Wpole = num(capRow0?.weight_kg, 0) * 9.81 / 1000;
    const Wtf = num(tfWeightKg, 0) * 9.81 / 1000;
    // conductors on weight span
    let Wcond = 0;
    for (let i = 0; i < (nHH + nH + nL); i++) {
      const ni = ns[i] || 0;
      const sc = stageCond[i];
      const w = unitWeight(sc); // N/m or kg? check unitWeight
      // unitWeight returns kg/m typically in this codebase - check
      Wcond += (w * ni * weightSpan) * 9.81 / 1000;
    }
    // If unitWeight is N/m, don't multiply 9.81 - inspect later
    const guyVert = (num(guyLoadDaN, 0) * Math.cos(toRad(guyAngleDeg || 30))) / 100;
    const downPull = 0;
    const Vtot = Wpole + Wtf + Wcond + guyVert + downPull;

    // Bearing
    const fp = parseFootprintMm(capRow0?.footprint_mm);
    const bearing = parseBearingMin(soil.bearing_kNm2);
    const types = [
      { name: 'A', d: 0 },
      { name: 'B', d: 200 },
      { name: 'C', d: 400 }
    ];
    const caps = {};
    let recType = 'X';
    for (const t of types) {
      const Lm = (fp.L + t.d) / 1000;
      const Wm = (fp.W + t.d) / 1000;
      const area = Lm * Wm;
      const cap = area * bearing; // kN
      caps[t.name] = cap;
      if (recType === 'X' && cap >= Vtot) recType = t.name;
    }
    // Minimum footprint area for bearing: area ≥ Vtot / bearing
    let area_min_m2 = null;
    if (bearing > 0) area_min_m2 = Vtot / bearing;

    // Recommendations on Foundations column
    let foundRec = '';
    if (stable && recType !== 'X') {
      foundRec = 'Type ' + recType;
    } else {
      const parts = [];
      if (!stable && B_min != null) parts.push('Overturning: min B ≥ ' + B_min.toFixed(3) + ' m');
      else if (!stable) parts.push('Overturning: enlarge / breast-heel block');
      if (recType === 'X' && area_min_m2 != null) {
        parts.push('Enlarge the footprint > ' + area_min_m2.toFixed(3) + ' m²');
      } else if (recType === 'X') {
        parts.push('Enlarge the footprint (bearing capacity insufficient; soil bearing data missing)');
      } else if (stable) {
        parts.push('Type ' + recType);
      }
      foundRec = parts.join('; ') || '—';
    }

    return {
      soil_class: soilClass,
      bmf_kNm: bmf,
      mg_kNm: Mg,
      subgrade_k: k,
      stable,
      overturning_alt: altRec,
      weight_pole_kN: Wpole,
      weight_tf_kN: Wtf,
      weight_cond_kN: Wcond, // Conductor vertical force (signed: + down-pull, − uplift)
      conductor_vertical_kN: Wcond,
      guy_vert_kN: guyVert,
      total_vertical_kN: Vtot,
      bearing_A_kN: caps.A,
      bearing_B_kN: caps.B,
      bearing_C_kN: caps.C,
      foundation_type: recType,
      embedment_m: P,
      fulcrum_delta_m: delta,
      footprint_mm: capRow0?.footprint_mm || '',
      below_gl_m: bGL,
      B_min_m: B_min,
      area_min_m2: area_min_m2,
      foundation_recommendation: foundRec
    };
  }


  function formatStrutted(mainClass, loadDaN) {
    const pair = pickStruttedPair(loadDaN);
    if (!pair) return 'X';
    const main = String(mainClass || '').replace(/\s*U\s*$/i, '').trim() || '200';
    return main + ' - ' + pair;
  }
  function pickGuyed(poleHeight, residualDaN, guyCls) {
    const list = NOMINAL[poleHeight] || NOMINAL[11];
    for (const o of list) {
      if (residualDaN <= o.cap) {
        const base = o.label.replace(' U','').replace('U','');
        return { label: base + ' ' + guyCls, base, cap: o.cap, rank: o.rank + 10, guyClass: guyCls };
      }
    }
    const last = list[list.length - 1];
    const base = last.label.replace(' U','').replace('U','');
    return { label: base + ' H', base, cap: last.cap, rank: 99, guyClass: 'H' };
  }
  function bucklingCapacityKN(poleHeight, classBase, capacities) {
    if (capacities && capacities.length) {
      const base = String(classBase).replace(/[^0-9]/g, '').slice(0, 4);
      const row = capacities.find(c =>
        Number(c.pole_height_m) === Number(poleHeight) &&
        String(c.class_label || '').includes(base) &&
        num(c.critical_buckling_kN, 0) > 0);
      if (row) return num(row.critical_buckling_kN);
    }
    const map = BUCKLING[poleHeight] || BUCKLING[11];
    const key = String(classBase).replace(/[^0-9]/g, '').slice(0, 4);
    return map[key] || map['350'] || 90;
  }
  function unitWeight(cond) {
    if (!cond) return 0;
    const fromTable = num(cond['Weight_kg/m'] || cond.Weight_kg_m, null);
    if (fromTable != null) return fromTable;
    const code = Number(cond.code);
    const map = {1:1.056,2:0.91,3:0.671,4:0.171,5:0.285,6:0.426,7:0.717,8:0.826,9:0.426,10:0.717,11:0.826};
    return map[code] || 0.4;
  }
  function verticalLoadKN(nH, nL, nHH, wHH, wH, wL, weightSpan, guyLoadDaN, tfKg, guyAngleDeg) {
    // Legacy average-weight-span path (fallback). Prefer conductorVerticalForceKN when available.
    const g = 9.8;
    let cond = 0;
    if (nHH && wHH) cond += nHH * wHH * weightSpan * g / 1000;
    if (nH && wH) cond += nH * wH * weightSpan * g / 1000;
    if (nL && wL) cond += nL * wL * weightSpan * g / 1000;
    const guyVert = guyLoadDaN * Math.cos(toRad(guyAngleDeg || 30)) / 100;
    const tf = (tfKg || 0) * g / 1000;
    return cond + guyVert + tf;
  }

  /**
   * Vertical reaction (kN, positive = down-pull on pole) at one end of a span from catenary.
   * H_kN = horizontal tension ≈ conductor tension at 15 °C+wind (BMT tension) — worst case for vertical only.
   * Returns { V_start_kN, V_end_kN, x0, L, w } for one conductor; multiply by N outside.
   * Flat equal supports → x0≈L/2 → V = w L / 2 each end (matches classical weight span).
   * Vertex outside span → one end uplift (negative V).
   */
  function catenaryVerticalEnds(cond, H_kN, L_m, elevA, elevB, attachH_A, attachH_B) {
    const W = num(cond?.['Weight_kg/m'] || cond?.Weight_kg_m, 0);
    const empty = { V_start_kN: 0, V_end_kN: 0, x0: L_m / 2, L: L_m || 0, w: 0 };
    if (!W || !H_kN || H_kN <= 0 || !L_m || L_m <= 0) {
      // No tension / no length: fall back to pure weight share L/2
      if (!W || !L_m || L_m <= 0) return empty;
      const Vhalf = (W * 9.81 * L_m / 2) / 1000;
      return { V_start_kN: Vhalf, V_end_kN: Vhalf, x0: L_m / 2, L: L_m, w: W * 9.81 };
    }
    const w = W * 9.81; // N/m
    const H = H_kN * 1000; // N
    const a = H / w;
    const yA = (elevA || 0) + (attachH_A || 0);
    const yB = (elevB || 0) + (attachH_B || 0);
    let u = 0;
    const dY = yB - yA;
    for (let i = 0; i < 40; i++) {
      const f = a * (Math.cosh((L_m / a) - u) - Math.cosh(-u)) - dY;
      const df = a * (-Math.sinh((L_m / a) - u) + Math.sinh(-u));
      if (Math.abs(df) < 1e-14) break;
      const step = f / df;
      u -= step;
      if (Math.abs(step) < 1e-10) break;
    }
    const x0 = u * a; // vertex from start; may be <0 or >L (uplift)
    // Vertical component V = w * horizontal distance from vertex to support (signed: down positive on pole)
    // At start (x=0): distance from vertex = -x0 → V_start = w*(-x0) if we take tension upward on conductor = down on pole when conductor is below...
    // Standard: reaction on support from conductor weight share = w * (distance along horizontal from vertex toward the support side of span interior).
    // V_A = H * sinh(-x0/a) = w * (-x0)  — if x0>0 (vertex to the right of A), V_A = -w*x0 is wrong sign convention.
    // Physical: both supports carry positive weight when vertex is between them: V_A = w*x0, V_B = w*(L-x0) when 0≤x0≤L.
    // When x0 < 0 (vertex left of A): V_A = w*x0 < 0 (uplift at A), V_B = w*(L-x0) > wL.
    // When x0 > L: V_A = w*x0 > wL, V_B = w*(L-x0) < 0 (uplift at B).
    const V_start_N = w * x0;
    const V_end_N = w * (L_m - x0);
    return {
      V_start_kN: V_start_N / 1000,
      V_end_kN: V_end_N / 1000,
      x0, L: L_m, w
    };
  }
  function insulatorLoad(tKN, diaMm, windSpan, angleDeg) {
    return 2 * tKN * 100 * Math.sin(toRad(angleDeg) / 2) + 57.5 * diaMm * windSpan / 1000;
  }
  /**
   * Intermediate-pole insulator + tie from Design Parameters thresholds (both 33 kV and 11 kV):
   *   α ≤ Top-tie max (°)  → Selected insulator + TTIE
   *   Top-tie max < α ≤ Side-tie max (°) → Selected insulator + STIE
   *   α > Side-tie max (°) → 2× Selected insulator + 2STIE
   * Terminal / section poles: {voltage} TEN** (no tie).
   * selectedDesc = user choice from Construction Data (e.g. "33kV Post").
   */
  function selectInsulatorByAngle(angleDeg, selectedDesc, voltageLabel, isDeadEnd, ttieMax, stieMax, opts) {
    const desc = (selectedDesc || '').trim() || (voltageLabel + ' insulator');
    if (isDeadEnd) {
      return { insulator: voltageLabel + ' TEN**', tie: '', detail: 'TEN**', R_kN: null, note: '' };
    }
    const a = Number(angleDeg) || 0;
    const tMax = (ttieMax != null && Number.isFinite(Number(ttieMax))) ? Number(ttieMax) : 10;
    const sMax = (stieMax != null && Number.isFinite(Number(stieMax))) ? Number(stieMax) : 20;
    // Resultant on insulator pin (kN, per conductor):
    // R = T1·sin(α/2) + T2·sin(α/2) + q_c · d · s_w · cos(α/2)
    let R = null, Rre = null, note = '';
    let base = null;
    if (opts && (opts.T1_kN != null || opts.T2_kN != null)) {
      const T1 = num(opts.T1_kN, 0) || 0;
      const T2 = num(opts.T2_kN, 0) || 0;
      const qc = (num(opts.qCond, 575) || 575) / 1000; // kN/m²
      const d = num(opts.dia_m, 0) || 0;
      const sw = num(opts.windSpan, 0) || 0;
      const s = Math.sin(toRad(a) / 2);
      const c = Math.cos(toRad(a) / 2);
      R = T1 * s + T2 * s + qc * d * sw * c;
      const cant = num(opts.cantilever_kN, 0) || 0;
      if (cant > 0 && R > cant + 1e-9) {
        const s4 = Math.sin(toRad(a) / 4);
        Rre = T1 * s4 + T2 * s4 + qc * d * sw * c;
        if (Rre <= cant + 1e-9) {
          base = { insulator: '2×' + desc, tie: '2STIE', detail: '2×' + desc + ' (R>' + cant + ' kN → 2× pin)' };
        } else {
          base = {
            insulator: desc,
            tie: '—',
            detail: desc,
            note: 'Tension Insulator required, re-run program with making section'
          };
        }
      }
    }
    if (!base) {
      if (a <= tMax) base = { insulator: desc, tie: 'TTIE', detail: desc };
      else if (a <= sMax) base = { insulator: desc, tie: 'STIE', detail: desc };
      else base = { insulator: '2×' + desc, tie: '2STIE', detail: '2×' + desc };
    }
    base.R_kN = R;
    base.R_recalc_kN = Rre;
    if (!base.note) base.note = note;
    return base;
  }
  // Legacy names kept as no-ops for any residual references
  function selectIns33(pi) { return '1PST/PIN'; }
  function selectIns11(pi) { return '1PST/PIN'; }
  function tfArea(equipKey, equipmentList) {
    if (!equipKey) return 0;
    const tf = (typeof findEquipmentRow === 'function')
      ? findEquipmentRow(equipmentList, equipKey)
      : (equipmentList || []).find(t => String(t.equipment) === String(equipKey) || Number(t.kva) === Number(equipKey));
    if (!tf) return 0;
    return num(tf.area_m2, 0) || (num(tf.width_m, 0) * num(tf.height_m, 0)) || 0;
  }
  function tfWeight(equipKey, equipmentList) {
    if (!equipKey) return 0;
    const tf = (typeof findEquipmentRow === 'function')
      ? findEquipmentRow(equipmentList, equipKey)
      : (equipmentList || []).find(t => String(t.equipment) === String(equipKey) || Number(t.kva) === Number(equipKey));
    return tf ? num(tf.weight_kg, 0) : 0;
  }

  function parseLevels(config) {
    const nHH = num(config.levels_HH, 0) || 0;
    const nH  = num(config.levels_H, 0) || 0;
    const nL  = num(config.levels_L, 0) || 0;
    const heights = String(config.heights_m || '')
      .split(';').map(s => parseFloat(String(s).trim())).filter(x => Number.isFinite(x));
    const ns = String(config.n_per_level || '')
      .split(';').map(s => parseFloat(String(s).trim())).filter(x => Number.isFinite(x));
    // Hierarchical: first nHH pairs = 33kV, next nH = 11kV, next nL = LV
    while (heights.length < nHH + nH + nL) {
      const idx = heights.length;
      if (idx < nHH) heights.push(num(config.H_HH_m) || (num(config.pole_height_m, 11) * 5/6 - 0.2));
      else if (idx < nHH + nH) heights.push(num(config.H_H_m) || (num(config.pole_height_m, 11) * 5/6 - 0.2));
      else heights.push(num(config.H_L_m) || (num(config.pole_height_m, 11) * 5/6 - 1.4));
    }
    while (ns.length < nHH + nH + nL) {
      const idx = ns.length;
      if (idx < nHH) ns.push(3);
      else if (idx < nHH + nH) ns.push(3);
      else ns.push(1);
    }
    return {
      nHH, nH, nL, heights, ns,
      guyH: num(config.guy_h_m, 8.4) || 8.4,
      tguyH: num(config.tguy_h_m, 8.4) || 8.4
    };
  }


  function computeLine(lineRows, settings, data, appState = {}) {
    const state = appState || {};
    // Always defined — used later in the pole BM loop (legacy = false)
    const isCommonMode = (state.lineStructureMode === 'common'
      && state.commonSections && state.commonSections.length > 0);

    let configNo = settings.config_no;
    if (isCommonMode)
      configNo = state.commonSections[0].config_no || configNo;
    let config = data.configs.find(c => String(c.config_no) === String(configNo)) || data.configs[0];
    if (!config) throw new Error('Unknown pole configuration: ' + configNo);

    // Common mode: union of level counts across all configs on the line
    if (isCommonMode) {
      let maxHH = 0, maxH = 0, maxL = 0, maxPH = 0;
      let bestCfg = config;
      const cfgs = [];
      const seen = new Set();
      (state.commonSections || []).forEach(cs => {
        const cfg = data.configs.find(c => String(c.config_no) === String(cs.config_no));
        if (cfg && !seen.has(String(cfg.config_no))) {
          seen.add(String(cfg.config_no));
          cfgs.push(cfg);
        }
      });
      (lineRows || []).forEach(r => {
        const cn = r.config_no || r.config_aft;
        if (!cn) return;
        const cfg = data.configs.find(c => String(c.config_no) === String(cn));
        if (cfg && !seen.has(String(cfg.config_no))) {
          seen.add(String(cfg.config_no));
          cfgs.push(cfg);
        }
      });
      cfgs.forEach(cfg => {
        maxHH = Math.max(maxHH, num(cfg.levels_HH, 0) || 0);
        maxH = Math.max(maxH, num(cfg.levels_H, 0) || 0);
        maxL = Math.max(maxL, num(cfg.levels_L, 0) || 0);
        const ph = num(cfg.pole_height_m, 0);
        if (ph >= maxPH) { maxPH = ph; bestCfg = cfg; }
      });
      let hs = String(bestCfg.heights_m || '').split(';').map(s => s.trim()).filter(Boolean);
      let nsArr = String(bestCfg.n_per_level || '').split(';').map(s => s.trim()).filter(Boolean);
      cfgs.forEach(cfg => {
        const h2 = String(cfg.heights_m || '').split(';').map(s => s.trim()).filter(Boolean);
        const n2 = String(cfg.n_per_level || '').split(';').map(s => s.trim()).filter(Boolean);
        for (let i = hs.length; i < h2.length; i++) hs.push(h2[i]);
        for (let i = nsArr.length; i < n2.length; i++) nsArr.push(n2[i]);
      });
      const need = maxHH + maxH + maxL;
      while (hs.length < need) hs.push(String((maxPH || 11) * 5 / 6 - 0.5));
      while (nsArr.length < need) {
        const idx = nsArr.length;
        nsArr.push(idx < maxHH + maxH ? '3' : '1');
      }
      config = Object.assign({}, bestCfg, {
        levels_HH: maxHH,
        levels_H: maxH,
        levels_L: maxL,
        pole_height_m: maxPH || bestCfg.pole_height_m,
        heights_m: hs.slice(0, need).join(';'),
        n_per_level: nsArr.slice(0, need).join(';')
      });
    }

    const spanTables = data.span_tension_tables || [];
    const byBand = settings.conductors_by_band || {
      HH: settings.conductor_HH ? [settings.conductor_HH] : [],
      H: settings.conductor_H ? [settings.conductor_H] : [],
      L: settings.conductor_LV ? [settings.conductor_LV] : []
    };
    if (typeof state !== 'undefined' && state.circuitSectionCI) {
      Object.keys(state.circuitSectionCI).forEach(id => {
        const code = state.circuitSectionCI[id].conductor_code;
        if (!code) return;
        const band = (id.split('|')[0] || '').split(':')[0];
        if (!band) return;
        if (!byBand[band]) byBand[band] = [];
        if (!byBand[band][0]) byBand[band][0] = code;
      });
    }
    const codeAt = (band, idx) => {
      const arr = byBand[band] || [];
      return arr[idx] || arr[0] || '';
    };
    const condAt = (band, idx) => data.conductors.find(c => String(c.code) === String(codeAt(band, idx)));

    const qCond = num(settings.wind_pressure_Nm2, 575);
    const qPole = num(settings.wind_pole_Nm2, 865);
    const ttieMax = num(settings.tie_thresholds?.ttie_max, 10);
    const stieMax = num(settings.tie_thresholds?.stie_max, 20);
    const guyAngle = num(settings.guy_wire_angle_deg, 30);

    const poleHeight = num(config.pole_height_m);
    const lv = parseLevels(config);
    const { nHH, nH, nL, heights, ns, guyH, tguyH } = lv;
    // Per-stage conductors via circuit identification (identical conductors within a circuit)
    const circuitId = identifyCircuits(config);
    const stageCond = new Array(nHH + nH + nL).fill(null);
    const bandCircuitOrdinal = { HH: 0, H: 0, L: 0 };
    // Map each circuit's conductor onto its level indices.
    // For shared levels (e.g. double vertical 2;2;2 L/R), prefer first circuit (Left) as representative
    // when conductors are identical; if R differs, still use level N from config with primary conductor
    // (typical designs use the same conductor on both sides of a vertical double circuit).
    (circuitId.circuits || []).forEach(circ => {
      const ord = bandCircuitOrdinal[circ.band]++;
      const cond = condAt(circ.band, ord);
      (circ.levelIndices || []).forEach(li => {
        if (!stageCond[li]) stageCond[li] = cond;
      });
    });
    // Fallback fill any missing stages — always from byBand so H ≠ L
    for (let i = 0; i < nHH; i++) stageCond[i] = condAt('HH', i) || stageCond[i];
    for (let i = 0; i < nH; i++) stageCond[nHH + i] = condAt('H', i) || stageCond[nHH + i];
    for (let i = 0; i < nL; i++) stageCond[nHH + nH + i] = condAt('L', i) || stageCond[nHH + nH + i];
    // Sanity: if H stage has same object as L stage, re-resolve H from byBand.H only
    for (let i = 0; i < nH; i++) {
      const h = stageCond[nHH + i];
      const l0 = nL > 0 ? stageCond[nHH + nH] : null;
      if (h && l0 && h === l0) {
        stageCond[nHH + i] = condAt('H', i);
      }
      // Also compare by code string
      if (h && l0 && String(h.code) === String(l0.code) && byBand.H && byBand.H[i] && String(byBand.H[i]) !== String(l0.code)) {
        stageCond[nHH + i] = condAt('H', i);
      }
    }
    // totals for vertical load (use per-stage weights)
    let nCondHH = 0, nCondH = 0, nCondL = 0;
    for (let i = 0; i < nHH; i++) nCondHH += ns[i] || 0;
    for (let i = nHH; i < nHH + nH; i++) nCondH += ns[i] || 0;
    for (let i = nHH + nH; i < nHH + nH + nL; i++) nCondL += ns[i] || 0;
    // representative (first of band) for insulator / display
    const condHH = stageCond[0] || null;
    const condH = stageCond[nHH] || null;
    const condLV = stageCond[nHH + nH] || null;
    const dHH = diaM(condHH), dH = diaM(condH), dL = diaM(condLV);
    const wHH = unitWeight(condHH), wH = unitWeight(condH), wL = unitWeight(condLV);

    let poleBreadth = BREADTH[poleHeight] || 0.28;
    if (data.capacities && data.capacities.length) {
      const breadths = data.capacities
        .filter(c => Number(c.pole_height_m) === poleHeight && num(c.avg_breadth_m, 0) > 0)
        .map(c => num(c.avg_breadth_m));
      if (breadths.length) poleBreadth = Math.max(...breadths);
    }

    // Common mode: merge dual transition rows (N-Aft + N-Fore) into one physical pole
    let rawRows = lineRows;
    if (isCommonMode) {
      const byPole = new Map();
      lineRows.forEach(r => {
        const p = num(r.pole_no);
        if (!byPole.has(p)) byPole.set(p, []);
        byPole.get(p).push(r);
      });
      rawRows = [];
      [...byPole.keys()].sort((a,b)=>a-b).forEach(p => {
        const group = byPole.get(p);
        if (group.length === 1) {
          rawRows.push(group[0]);
          return;
        }
        const aftR = group.find(x => x.transition_side === 'aft') || group[0];
        const foreR = group.find(x => x.transition_side === 'fore') || group.find(x => x.geometry_row !== false) || group[group.length-1];
        const geo = group.find(x => x.geometry_row !== false) || foreR;
        rawRows.push({
          ...geo,
          pole_no: p,
          transition: true,
          transition_side: '',
          config_aft: aftR.config_aft || aftR.config_no,
          config_fore: foreR.config_fore || foreR.config_no,
          config_no: foreR.config_no || geo.config_no, // PH from fore
          circuit_sections: Object.assign({}, aftR.circuit_sections || {}, foreR.circuit_sections || {}),
          circuit_sections_aft: Object.assign({}, aftR.circuit_sections || {}),
          circuit_sections_fore: Object.assign({}, foreR.circuit_sections || {}),
          // Eq-span grouping: attribute transition pole (and its fore span) to the AFT section
          // so last span of section 1 is included (e.g. 38 m → sec1 Leq = 32.8 m)
          section: aftR.section || aftR.common_section_no || geo.section,
          common_section_no: (aftR.common_section_no || '') + '/' + (foreR.common_section_no || '')
        });
      });
    }
    const rows = rawRows.map(r => ({
      ...r,
      pole_no: num(r.pole_no), aft: num(r.aft_span_m, 0), fore: num(r.fore_span_m, 0),
      elev_delta: num(r.elev_delta_m, 0),
      angle: num(r.angle_deg, 0), soil: r.soil_class, equipment: r.equipment || r.transformer_kva || '', kva: (typeof parseEquipmentKva === 'function' ? parseEquipmentKva(r.equipment || r.transformer_kva) : num(r.transformer_kva, 0)),
      section: r.section,
      span_environment: r.span_environment || 'along or across any road or street',
      survey_points: Array.isArray(r.survey_points) ? r.survey_points : [],
      structure_points: Array.isArray(r.structure_points) ? r.structure_points : [],
      spur_enabled: !!r.spur_enabled,
      spur_circuits: Array.isArray(r.spur_circuits) ? r.spur_circuits : [],
      guy_theta_enabled: !!r.guy_theta_enabled,
      guy_theta_deg: (r.guy_theta_enabled ? num(r.guy_theta_deg, 0) : 0),
      guy_pole_angle_deg: num(r.guy_pole_angle_deg, num(settings.guy_wire_angle_deg, 30)),
      crossarms: r.crossarms || { HH: [], H: [] },
      circuit_sections: r.circuit_sections || {},
      circuit_sections_aft: r.circuit_sections_aft || null,
      circuit_sections_fore: r.circuit_sections_fore || null,
      config_aft: r.config_aft,
      config_fore: r.config_fore,
      transition: !!r.transition
    }));
    // Absolute ground elevations.
    // Elev Δ on pole n = elevation of pole (n+1) relative to pole n
    // (value “in front of” pole 3 means pole 4 is that many metres above pole 3).
    // Pole 1 of each section is local datum = 0.
    // abs_elev[pole k] = sum of elev_delta values stored on poles before k in the section.
    const absElev = {};
    {
      // Continuous absolute elevation along the line in input order.
      // Do NOT reset at section changes: a new section on a sequential route still
      // shares the physical joint elevation with the previous pole (avoids fictitious
      // cliffs at section boundaries that corrupt catenary vertical force / clearance).
      let runElev = 0;
      rows.forEach((r, i) => {
        absElev[r.section + ':' + r.pole_no] = runElev;
        r.abs_elev = runElev;
        runElev += (r.elev_delta || 0);
      });
    }
    // Unequal if any Elev Δ ≠ 0 or any survey points on a fore span
    const sectionUnequal = {};
    rows.forEach(r => {
      const key = String(r.section);
      if (!sectionUnequal[key]) sectionUnequal[key] = false;
      if (Math.abs(r.elev_delta || 0) > 1e-6 || (r.survey_points && r.survey_points.length)) {
        sectionUnequal[key] = true;
      }
    });
    // Circuit stage metadata for dynamic headers
    const nStages = nHH + nH + nL;
    const stageBands = [];
    const stageVoltLabels = [];
    for (let i = 0; i < nStages; i++) {
      const b = stageBand(i, nHH, nH, nL);
      stageBands.push(b);
      stageVoltLabels.push(circuitBandLabel(b));
    }
    const bottomBand = bottomMostBand(nHH, nH, nL);
    // bottom-most stage index = last stage
    const bottomStageIdx = nStages > 0 ? nStages - 1 : 0;

    const sectionSpans = {};
    rows.forEach(r => {
      if (!sectionSpans[r.section]) sectionSpans[r.section] = [];
      if (r.fore > 0) sectionSpans[r.section].push(r.fore);
    });
    // Line Tension Factors (%): scale 15°C+wind and T27 for 33 kV, 11 kV and LV stages
    const tfMap = (settings && settings.tension_factors) || {};
    const factorFor = (sec, band, idx, circuitSecNo) => {
      // Prefer per circuit/section factor: key "H:1|2" = band circuit 1-based | section no
      const circ1 = (idx != null ? Number(idx) + 1 : 1);
      const csKey = band + ':' + circ1 + (circuitSecNo != null && circuitSecNo !== '' ? '|' + circuitSecNo : '');
      if (tfMap[csKey] != null) {
        const pct = num(tfMap[csKey], 100);
        return (Number.isFinite(pct) ? pct : 100) / 100;
      }
      const secMap = tfMap[String(sec)] || {};
      if (secMap[csKey] != null) {
        const pct = num(secMap[csKey], 100);
        return (Number.isFinite(pct) ? pct : 100) / 100;
      }
      const pct = num(secMap[band + ':' + idx], 100);
      return (Number.isFinite(pct) ? pct : 100) / 100;
    };

    const sectionEq = {}, sectionTen = {};
    const calcMethod = settings.calc_method || 'leco_standard';
    const isClearanceBased = calcMethod === 'clearance_based';
    const tSag = num(settings.cb_t_sag, 65);
    const tWind = num(settings.cb_t_wind, 15);
    // Helper: applicable ground clearance for a row
    const groundClearM = (row, bandLabel) => {
      if ((settings.clearance_source || 'regulatory') === 'user') {
        return num(settings.user_gc?.[bandLabel] ?? settings.user_gc?.[bandLabel.replace('kV','')], 5.5);
      }
      const env = row.span_environment || 'along or across any road or street';
      const rowsGC = (data.ground_clearances || []).filter(g => {
        const vb = String(g.voltage_band || g.voltage || '');
        return vb === bandLabel || vb.includes(bandLabel.replace('kV',''));
      });
      let best = null;
      rowsGC.forEach(g => {
        const desc = String(g.description || g.environment || '').toLowerCase();
        const envL = env.toLowerCase();
        if (desc && envL.includes(desc.slice(0, 12))) best = num(g.min_clearance_m, null);
      });
      if (best == null && rowsGC.length) best = num(rowsGC[0].min_clearance_m, 5.5);
      return best != null ? best : 5.5;
    };
    const ccClearM = (upperBand, lowerBand) => {
      if ((settings.clearance_source || 'regulatory') === 'user') {
        const k = upperBand + '|' + lowerBand;
        return num(settings.user_cc?.[k], 1.2);
      }
      const rowsCC = data.circuit_clearances || [];
      const hit = rowsCC.find(c => {
        const u = String(c.upper_band || ''), l = String(c.lower_band || '');
        return (u === upperBand || u.includes(upperBand.replace('kV',''))) &&
               (l === lowerBand || l.includes(lowerBand.replace('kV','')));
      });
      return hit ? num(hit.min_vertical_m, 1.2) : 1.2;
    };
    const bandLabelOf = (i) => (i < nHH ? '33kV' : (i < nHH + nH ? '11kV' : 'LV'));
    const bandCodeOf = (i) => (i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L'));
    // Bottom stage index (section-level helpers for clearance-based)
    const bottomStageIdxCB = (nHH + nH + nL) - 1;
    const bottomBandCode = bandCodeOf(Math.max(0, bottomStageIdxCB));
    const bottomBandLabel = bandLabelOf(Math.max(0, bottomStageIdxCB));

    Object.keys(sectionSpans).forEach(sec => {
      const eq = equivalentSpan(sectionSpans[sec]);
      sectionEq[sec] = eq;
      let stageT;
      if (!isClearanceBased) {
        // LECO Standard: Full table tensions at 15°C+wind, then Line Tension Factor
        stageT = stageCond.map((sc, i) => {
          const raw = conductorTensionKN(sc, eq, spanTables);
          const band = bandCodeOf(i);
          const localIdx = band === 'HH' ? i : (band === 'H' ? i - nHH : i - nHH - nH);
          return raw * factorFor(sec, band, localIdx);
        });
      } else {
        // Clearance-based tension design (section-governed, most restrictive span)
        // 1) Max allowable sag @ tSag for bottom circuit (flat formula; envelope scan when uneven/structures)
        // 2) Propagate upward using attachment Δh and CC clearances
        // 3) Invert catenary → H_sag (still air, self-weight only)
        // 4) State-change to tWind with w_eff → T_wind (kN)
        const secRows = rows.filter(r => String(r.section) === String(sec));
        // Stacked circuit-to-circuit from bottom to top (Σt) + top attach offset on TOP circuit
        let sumT = 0;
        for (let i = bottomStageIdxCB; i > 0; i--) {
          sumT += ccClearM(bandLabelOf(i - 1), bandLabelOf(i));
        }
        // For multi-level same voltage vertical on one side: use same-band separation if needed (future)
        const topBand = bandCodeOf(0);
        const rTop = topAttachOffsetM(topBand);
        const bottomCond = stageCond[bottomStageIdxCB];
        const pCreep = creepageAllowanceM(settings, bottomBandCode, bottomCond);

        // Per-stage max sag (m) governed by most restrictive span in section
        const stageMaxSag = new Array(stageCond.length).fill(null);
        const stageH_sag = new Array(stageCond.length).fill(null);

        // Evaluate each fore span in the section
        let govBottomSag = Infinity;
        secRows.forEach((r, ri) => {
          const L = r.fore > 0 ? r.fore : 0;
          if (L <= 0) return;
          const o = groundClearM(r, bottomBandLabel);
          // Flat baseline max sag for bottom
          let sMax = maxAllowableSagFlatM(poleHeight, o, pCreep, sumT, rTop);
          // Structure / uneven: reduce sMax using envelope scan with parabolic approximation
          const hasUneven = Math.abs(r.elev_delta || 0) > 1e-6 || (r.survey_points && r.survey_points.length) ||
            (r.structure_points && r.structure_points.length);
          if (hasUneven && bottomCond) {
            const W = num(bottomCond['Weight_kg/m'] || bottomCond.Weight_kg_m, 0);
            const elevA = r.abs_elev || 0;
            const elevB = elevA + (r.elev_delta || 0);
            const hAtt = heights[bottomStageIdxCB] || (poleHeight * 5 / 6);
            // Binary search max mid-chord sag that still meets clearances
            let lo = 0.05, hi = Math.max(sMax, 0.5), best = sMax;
            for (let it = 0; it < 28; it++) {
              const mid = (lo + hi) / 2;
              // Sample clearance with parabolic sag mid relative to chord
              let ok = true;
              const nSamp = 24;
              for (let k = 0; k <= nSamp; k++) {
                const x = (L * k) / nSamp;
                const xi = x / L;
                const yChord = elevA + hAtt + (elevB - elevA) * xi;
                const yCond = yChord - 4 * mid * xi * (1 - xi);
                // terrain
                let yG = elevA + (elevB - elevA) * xi;
                if (r.survey_points && r.survey_points.length) {
                  const pts = r.survey_points;
                  // linear interpolate survey
                  let yS = yG;
                  for (let j = 0; j < pts.length - 1; j++) {
                    if (x >= pts[j].x && x <= pts[j + 1].x) {
                      const f = (x - pts[j].x) / Math.max(pts[j + 1].x - pts[j].x, 1e-9);
                      yS = (elevA + pts[j].h) + f * ((elevA + pts[j + 1].h) - (elevA + pts[j].h));
                      break;
                    }
                  }
                  yG = yS;
                }
                if (yCond - yG < o - 1e-6) { ok = false; break; }
                // structures
                (r.structure_points || []).forEach(sp => {
                  if (Math.abs(sp.x - x) > L / nSamp) return;
                  const ySt = yG + num(sp.h, 0);
                  // structure clearance from table
                  let oS = o;
                  const scRows = (data.structure_clearances || []).filter(s => {
                    const vb = String(s.voltage_band || '');
                    return !vb || vb === bottomBandLabel || vb.includes(bottomBandLabel.replace('kV',''));
                  });
                  if (scRows.length) oS = num(scRows[0].min_clearance_m, o);
                  if (yCond - ySt < oS - 1e-6) ok = false;
                });
                if (!ok) break;
              }
              if (ok) { best = mid; lo = mid; } else { hi = mid; }
            }
            sMax = best;
          }
          if (sMax < govBottomSag) govBottomSag = sMax;
        });
        if (!Number.isFinite(govBottomSag) || govBottomSag <= 0) {
          // Fallback: use flat with default road clearance
          govBottomSag = maxAllowableSagFlatM(poleHeight, 5.5, pCreep, sumT, rTop);
        }
        // Bottom max sag governs section
        stageMaxSag[bottomStageIdxCB] = govBottomSag;
        // Propagate upward: s_upper = Δh_attach − t_cc + s_lower
        for (let i = bottomStageIdxCB - 1; i >= 0; i--) {
          const dH = Math.abs((heights[i] || 0) - (heights[i + 1] || 0));
          const tcc = ccClearM(bandLabelOf(i), bandLabelOf(i + 1));
          stageMaxSag[i] = dH - tcc + stageMaxSag[i + 1];
          if (stageMaxSag[i] < 0.05) stageMaxSag[i] = 0.05;
        }
        // Invert to H at tSag (self-weight only) using section eq span as representative length
        // Most restrictive: use max span in section for conservative H (larger L → larger H for same sag)
        const spansInSec = sectionSpans[sec] || [];
        const Lgov = spansInSec.length ? Math.max(...spansInSec) : eq;
        stageT = stageCond.map((sc, i) => {
          if (!sc) return 0;
          const W = num(sc['Weight_kg/m'] || sc.Weight_kg_m, 0);
          const sMax = stageMaxSag[i] != null ? stageMaxSag[i] : govBottomSag;
          if (!W || !sMax || sMax <= 0) return 0;
          const H_sag_N = horizontalTensionFromSagN(W, Lgov, sMax);
          stageH_sag[i] = H_sag_N;
          // State-change: (tSag, W_self, H_sag) → (tWind, W_eff, T_wind)
          const E = conductorEN(sc) || (6600 * 9.80665e6);
          const alpha = conductorAlpha(sc) || 0.000023;
          const A = conductorAreaM2(sc);
          const We = conductorWeffKgM(sc, qCond);
          const T_wind_N = stateChangeTensionN(H_sag_N, W, E, alpha, A, Lgov, tSag, tWind, We);
          const band = bandCodeOf(i);
          const localIdx = band === 'HH' ? i : (band === 'H' ? i - nHH : i - nHH - nH);
          const fac = factorFor(sec, band, localIdx);
          return (T_wind_N / 1000) * fac;
        });
        // Stash sag profile info on sectionTen for diagnostics
        sectionTen[sec] = sectionTen[sec] || {};
      }
      // stageT[i] is ALWAYS per-conductor tension (kN)
      sectionTen[sec] = {
        stages: stageT,
        HH: nCondHH ? stageT[0] : 0,
        H:  nCondH  ? stageT[nHH] : 0,
        L:  nCondL  ? (stageT[nHH + nH] || 0) : 0,
        method: calcMethod,
        max_sag_m: isClearanceBased ? stageT.map((_, i) => null) : null
      };
    });

    // --- Common mode: per circuit-section eq span & tension (isolates sec1 from sec2 config) ---
    const ciEq = {};  // id → Leq
    const ciTen = {}; // id → tension kN at 15+wind
    if (isCommonMode && typeof state !== 'undefined' && state.circuitSectionCI) {
      Object.keys(state.circuitSectionCI).forEach(id => {
        const ci = state.circuitSectionCI[id] || {};
        const fromP = num(ci.from_pole, 0), toP = num(ci.to_pole, 0);
        // spans: fore of poles from fromP .. toP-1 (and transition attribution)
        const spans = [];
        rows.forEach(r => {
          const p = num(r.pole_no);
          if (p >= fromP && p < toP && r.fore > 0) spans.push(r.fore);
          // include last span of section if pole == toP-? standard: poles from..to-1 contribute fore
        });
        let sumL = 0, sumL3 = 0;
        spans.forEach(L => { const x = num(L, 0); if (x > 0) { sumL += x; sumL3 += x * x * x; } });
        const Leq = sumL > 0 ? Math.sqrt(sumL3 / sumL) : 0;
        ciEq[id] = Leq;
        const code = ci.conductor_code;
        const sc = code ? data.conductors.find(c => String(c.code) === String(code)) : null;
        let T = 0;
        if (sc && Leq > 0) {
          T = conductorTensionKN(sc, Leq, spanTables) || 0;
          const pct = num(ci.tension_factor_pct, 100);
          T *= (Number.isFinite(pct) ? pct : 100) / 100;
        }
        ciTen[id] = T;
      });
    }

    // T65 (or T at tSag) per section — for clearance profiles
    const sectionT65 = {};
    Object.keys(sectionEq).forEach(sec => {
      const eq = sectionEq[sec] || 0;
      if (!isClearanceBased) {
        sectionT65[sec] = stageCond.map((sc, i) => {
          if (!sc || eq <= 0) return null;
          const band = i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L');
          const localIdx = band === 'HH' ? i : (band === 'H' ? i - nHH : i - nHH - nH);
          const fac = factorFor(sec, band, localIdx);
          const T27_kN = (lookupTension27KN(sc, eq, spanTables) || 0) * fac;
          const T27_N = T27_kN * 1000;
          const W = num(sc['Weight_kg/m'] || sc.Weight_kg_m, 0);
          if (!W || !T27_N) return null;
          const E_N_m2 = conductorEN(sc) || (6600 * 9.80665e6);
          const alpha = conductorAlpha(sc) || 0.000023;
          const A = conductorAreaM2(sc);
          return stateChangeTensionN(T27_N, W, E_N_m2, alpha, A, eq, 27, 65);
        });
      } else {
        // Clearance-based: T at max-sag temperature from H_sag (still air). Recover via inverse state-change
        // from T_wind already stored, or recompute H from max sag path.
        const spansInSec = sectionSpans[sec] || [];
        const Lgov = spansInSec.length ? Math.max(...spansInSec) : eq;
        const ten = sectionTen[sec];
        sectionT65[sec] = stageCond.map((sc, i) => {
          if (!sc || !ten || !ten.stages) return null;
          const W = num(sc['Weight_kg/m'] || sc.Weight_kg_m, 0);
          const Twind_N = (ten.stages[i] || 0) * 1000;
          if (!W || !Twind_N) return null;
          const E = conductorEN(sc) || (6600 * 9.80665e6);
          const alpha = conductorAlpha(sc) || 0.000023;
          const A = conductorAreaM2(sc);
          const We = conductorWeffKgM(sc, qCond);
          // State-change from wind state back to sag temperature (self weight)
          return stateChangeTensionN(Twind_N, We, E, alpha, A, Lgov, tWind, tSag, W);
        });
      }
    });

    let prevSection = null;

    // Conductor tension checks vs UTS criteria (Design Criteria)
    const edsPct = num(settings.eds_pct_uts, 20) / 100;
    const maxPct = num(settings.max_stress_pct_uts, 40) / 100;
    const tensionChecks = []; // {section, circuitLabel, band, code, T15w_kN, T27_kN, UTS_daN, limit15_kN, limit27_kN, ok15, ok27}
    Object.keys(sectionEq).forEach(sec => {
      const eqS = sectionEq[sec];
      const ten = sectionTen[sec] || {};
      // Unique conductors by circuit
      const seen = new Set();
      stageCond.forEach((sc, i) => {
        if (!sc) return;
        const code = String(sc.code || '');
        const key = sec + '|' + code + '|' + i;
        // one check per stage conductor
        const utsDaN = num(sc.Ultimate_Tensile_Strength_daN ?? sc['Ultimate_Tensile_Strength_daN'] ?? sc.UTS_daN, 0);
        if (!utsDaN) return;
        const band = i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L');
        const loc = band === 'HH' ? i : (band === 'H' ? i - nHH : i - nHH - nH);
        const fac = Math.max(0.05, (typeof factorFor === 'function' ? factorFor(sec, band, loc) : 1));
        // T15+wind from sectionTen (already factored in compute) — also recompute from tables
        let T15 = null;
        if (ten.stages && ten.stages[i] != null) T15 = ten.stages[i];
        else {
          const t15raw = conductorTensionKN(sc, eqS, spanTables);
          if (t15raw != null) T15 = t15raw * fac;
        }
        const t27raw = lookupTension27KN(sc, eqS, spanTables);
        const T27 = (t27raw != null ? t27raw : 0) * fac;
        const limit15 = (utsDaN * maxPct) / 100; // daN → kN
        const limit27 = (utsDaN * edsPct) / 100;
        const ok15 = T15 != null && T15 <= limit15 + 1e-9;
        const ok27 = T27 != null && T27 <= limit27 + 1e-9;
        const label = (stageVoltLabels && stageVoltLabels[i]) ? stageVoltLabels[i] : ('C' + (i + 1));
        const pct15 = (utsDaN > 0 && T15 != null) ? (T15 * 100 / utsDaN) * 100 : null; // T_kN→daN / UTS
        const pct27 = (utsDaN > 0 && T27 != null) ? (T27 * 100 / utsDaN) * 100 : null;
        tensionChecks.push({
          section: sec, stage: i, circuitLabel: label, band, code,
          description: sc.description || '',
          T15w_kN: T15, T27_kN: T27,
          UTS_daN: utsDaN,
          limit15_kN: limit15, limit27_kN: limit27,
          pct15_uts: pct15, pct27_uts: pct27,
          eds_pct: edsPct * 100, max_pct: maxPct * 100,
          ok15, ok27, ok: ok15 && ok27
        });
      });
    });

    // Common mode: label tension checks with Circuit/Section and From–To poles; drop absent circuits
    if (isCommonMode && typeof state !== 'undefined' && state.circuitSectionCI) {
      const ciList = Object.keys(state.circuitSectionCI).map(id => {
        const ci = state.circuitSectionCI[id];
        const [bandCirc, secNo] = id.split('|');
        const [band, circ] = (bandCirc || '').split(':');
        return { id, band, circ: Number(circ) || 1, secNo, from: ci.from_pole, to: ci.to_pole, code: ci.conductor_code };
      }).filter(x => x.code);
      if (ciList.length) {
        const rebuilt = [];
        ciList.forEach(ci => {
          // find matching tension check by band/code or create from sectionTen
          const band = ci.band;
          const stageIdx = (band === 'HH' ? 0 : band === 'H' ? nHH : nHH + nH) + (ci.circ - 1);
          let match = tensionChecks.find(t => t.band === band && String(t.code) === String(ci.code));
          if (!match) match = tensionChecks.find(t => t.band === band && t.stage === stageIdx);
          const volt = band === 'HH' ? '33kV' : band === 'H' ? '11kV' : 'LV';
          const label = volt + ' Circuit ' + ci.circ + ' Sec ' + ci.secNo;
          const fromTo = (ci.from != null && ci.to != null) ? (ci.from + '–' + ci.to) : '—';
          if (match) {
            rebuilt.push(Object.assign({}, match, {
              section: ci.secNo || match.section,
              circuitLabel: label,
              from_to: fromTo,
              circuit_id: ci.id
            }));
          }
        });
        if (rebuilt.length) tensionChecks.length = 0, rebuilt.forEach(x => tensionChecks.push(x));
      }
    }

    const results = rows.map((r, idx) => {
      const windSpan = (r.aft + r.fore) / 2;
      const weightSpan = windSpan;
      const isFirst = idx === 0, isLast = idx === rows.length - 1;
      const isNewSection = r.section !== prevSection && idx > 0;
      const isTerminal = isFirst || isLast || r.aft === 0 || r.fore === 0;
      // Common mode: section pole = end pole of a circuit-section (To) or start of next (From),
      // excluding pure line terminals. Geometry isNewSection used only in legacy.
      let isSectionPole = false;
      if (isCommonMode && typeof state !== 'undefined' && state.circuitSectionCI) {
        const p = num(r.pole_no);
        Object.keys(state.circuitSectionCI).forEach(id => {
          const ci = state.circuitSectionCI[id] || {};
          const f = Number(ci.from_pole), t = Number(ci.to_pole);
          // Boundary pole shared by sections (to of one / from of another), not pure line end-only terminal
          if (p === t || p === f) {
            if (!(isTerminal && p === f && p === t)) isSectionPole = true;
          }
        });
        // Do not mark pure terminals as section poles
        if (isTerminal && (isFirst || isLast)) isSectionPole = false;
      } else {
        isSectionPole = !isTerminal && isNewSection;
      }
      // Also mark explicit transition poles
      if (!isTerminal && r.transition) isSectionPole = true;
      prevSection = r.section;

      // Resolve THIS pole's configuration from common sections BEFORE BM (not the union)
      if (isCommonMode && state.commonSections && state.commonSections.length) {
        const pNo = num(r.pole_no);
        if (!r.transition) {
          for (let ci = 0; ci < state.commonSections.length; ci++) {
            const cs = state.commonSections[ci];
            const a = num(cs.start_pole), b = num(cs.end_pole);
            const next = state.commonSections[ci + 1];
            const isTransEnd = next && num(next.start_pole) === b && pNo === b;
            const prev = state.commonSections[ci - 1];
            const isTransStart = prev && num(prev.end_pole) === a && pNo === a;
            if (pNo >= a && pNo <= b && !isTransEnd && !isTransStart) {
              r.config_no = cs.config_no;
              r.config_aft = cs.config_no;
              r.config_fore = cs.config_no;
              break;
            }
          }
        } else {
          // keep aft/fore; display PH from for
          if (r.config_fore) r.config_no = r.config_fore;
        }
      }

      const eqSpan = sectionEq[r.section] || equivalentSpan([r.aft, r.fore].filter(x => x > 0));
      const tenFore = sectionTen[r.section] || { HH: 0, H: 0, L: 0, stages: [] };
      let tenAft = tenFore;
      if (idx > 0 && sectionTen[rows[idx - 1].section])
        tenAft = sectionTen[rows[idx - 1].section];

      const tHH1 = tenAft.HH, tH1 = tenAft.H, tL1 = tenAft.L;
      const tHH2 = tenFore.HH, tH2 = tenFore.H, tL2 = tenFore.L;
      const tHH = tHH2, tH = tH2, tL = tL2;
      const stageT2 = (tenFore.stages && tenFore.stages.length) ? tenFore.stages
        : stageCond.map(sc => conductorTensionKN(sc, eqSpan, spanTables));
      const eqAft = (idx > 0 && sectionEq[rows[idx - 1].section] != null)
        ? sectionEq[rows[idx - 1].section] : eqSpan;
      const stageT1 = (tenAft.stages && tenAft.stages.length) ? tenAft.stages
        : stageCond.map(sc => conductorTensionKN(sc, eqAft, spanTables));

      // Multi-level BMC/BMT: each stage uses its own conductor dia & tension
      // BM_long terminal: Σ N·T·H (full tension longitudinal) — unchanged
      // BM_long section/intermediate residual: Σ (T1−T2)·cos(α/2)·N·H
      //   (net longitudinal from unequal section tensions; T1=aft, T2=fore at 15°C+wind)
      let bmC = 0, bmT = 0, bmT_long = 0, bmT_long_section = 0;
      const cosHalf = Math.cos(toRad(r.angle) / 2);
      const sinHalf = Math.sin(toRad(r.angle) / 2);
      const qC = (qCond || 575) / 1000;
      // Per-pole height: on transition poles use FORE section config (user rule)
      let poleHeightLocal = poleHeight;
      let poleBreadthLocal = poleBreadth;
      if (isCommonMode && (r.config_no || r.config_aft || r.config_fore)) {
        // Non-transition: always this pole's config_no (already resolved). Transition: PH from for.
        const cnPH = r.transition ? (r.config_fore || r.config_no) : (r.config_no || r.config_aft);
        const cfgP = data.configs.find(c => String(c.config_no) === String(cnPH));
        if (cfgP) {
          poleHeightLocal = num(cfgP.pole_height_m, poleHeight) || poleHeight;
          let bLocal = BREADTH[poleHeightLocal] || poleBreadth;
          if (data.capacities && data.capacities.length) {
            const breadths = data.capacities
              .filter(c => Number(c.pole_height_m) === Number(poleHeightLocal) && num(c.avg_breadth_m, 0) > 0)
              .map(c => num(c.avg_breadth_m));
            if (breadths.length) bLocal = Math.max(...breadths);
          }
          poleBreadthLocal = bLocal;
        }
      }
      // Heights & N: split aft / for for transition; own config for normal poles (never union)
      // Aft side of transition → config_aft heights for after-span circuits
      // Fore side of transition → config_fore heights for fore-span circuits
      let heightsAft = heights, heightsFore = heights, nsAft = ns, nsFore = ns;
      if (isCommonMode) {
        const cfgA = data.configs.find(c => String(c.config_no) === String(r.config_aft || r.config_no));
        const cfgF = data.configs.find(c => String(c.config_no) === String(r.config_fore || r.config_no));
        if (cfgA) {
          const lvA = parseLevels(cfgA);
          heightsAft = lvA.heights; nsAft = lvA.ns;
        }
        if (cfgF) {
          const lvF = parseLevels(cfgF);
          heightsFore = lvF.heights; nsFore = lvF.ns;
        }
        if (!r.transition) {
          // Normal pole: both sides same config
          heightsFore = heightsAft; nsFore = nsAft;
        }
      }
      const csAft = (r.circuit_sections_aft || r.circuit_sections || {});
      const csFore = (r.circuit_sections_fore || r.circuit_sections || {});
      for (let i = 0; i < nHH + nH + nL; i++) {
        const band = i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L');
        const localIdx = band === 'HH' ? i : (band === 'H' ? i - nHH : i - nHH - nH);
        const key = band + ':' + (localIdx + 1);
        // Map union stage index → index inside each side's own config height list
        let iAft = i, iFore = i;
        if (isCommonMode) {
          const cfgA = data.configs.find(c => String(c.config_no) === String(r.config_aft || r.config_no));
          const cfgF = data.configs.find(c => String(c.config_no) === String(r.config_fore || r.config_no));
          if (cfgA) {
            const aHH = num(cfgA.levels_HH,0)||0, aH = num(cfgA.levels_H,0)||0;
            if (band === 'HH') iAft = localIdx;
            else if (band === 'H') iAft = aHH + localIdx;
            else iAft = aHH + aH + localIdx;
          }
          if (cfgF) {
            const fHH = num(cfgF.levels_HH,0)||0, fH = num(cfgF.levels_H,0)||0;
            if (band === 'HH') iFore = localIdx;
            else if (band === 'H') iFore = fHH + localIdx;
            else iFore = fHH + fH + localIdx;
          }
        }
        let niA = (nsAft[iAft] != null ? nsAft[iAft] : ns[i]) || 0;
        let niF = (nsFore[iFore] != null ? nsFore[iFore] : ns[i]) || 0;
        const hiA = (heightsAft[iAft] != null ? heightsAft[iAft] : heights[i]) || 0;
        const hiF = (heightsFore[iFore] != null ? heightsFore[iFore] : heights[i]) || 0;
        if (isCommonMode) {
          const secA = csAft[key];
          const secF = csFore[key];
          if (secA === '' || secA == null) niA = 0;
          if (secF === '' || secF == null) niF = 0;
          // Also hide stages that do not exist on the aft/fore pole configurations
          if (r.config_aft || r.config_no) {
            const cfgA = data.configs.find(c => String(c.config_no) === String(r.config_aft || r.config_no));
            if (cfgA) {
              const aHH = num(cfgA.levels_HH,0)||0, aH = num(cfgA.levels_H,0)||0, aL = num(cfgA.levels_L,0)||0;
              if (band === 'HH' && localIdx >= aHH) niA = 0;
              if (band === 'H' && localIdx >= aH) niA = 0;
              if (band === 'L' && localIdx >= aL) niA = 0;
            }
          }
          if (r.config_fore || r.config_no) {
            const cfgF = data.configs.find(c => String(c.config_no) === String(r.config_fore || r.config_no));
            if (cfgF) {
              const fHH = num(cfgF.levels_HH,0)||0, fH = num(cfgF.levels_H,0)||0, fL = num(cfgF.levels_L,0)||0;
              if (band === 'HH' && localIdx >= fHH) niF = 0;
              if (band === 'H' && localIdx >= fH) niF = 0;
              if (band === 'L' && localIdx >= fL) niF = 0;
            }
          }
          // Non-transition: both sides same config
          if (!r.transition && r.config_no) {
            const cfgP = data.configs.find(c => String(c.config_no) === String(r.config_no));
            if (cfgP) {
              const pHH = num(cfgP.levels_HH,0)||0, pH = num(cfgP.levels_H,0)||0, pL = num(cfgP.levels_L,0)||0;
              let inP = true;
              if (band === 'HH' && localIdx >= pHH) inP = false;
              if (band === 'H' && localIdx >= pH) inP = false;
              if (band === 'L' && localIdx >= pL) inP = false;
              if (!inP) { niA = 0; niF = 0; }
            }
          }
        }
        const sc = stageCond[i];
        const di = diaM(sc);
        let t1 = stageT1[i] != null ? stageT1[i] : 0;
        let t2 = stageT2[i] != null ? stageT2[i] : 0;
        // Common mode: tension from THIS circuit-section's own eq span & conductor (not union section)
        if (isCommonMode && typeof ciTen !== 'undefined') {
          const secA = csAft[key];
          const secF = csFore[key];
          if (secA !== '' && secA != null) {
            const idA = key + '|' + String(secA).trim();
            if (ciTen[idA] != null && ciTen[idA] > 0) t1 = ciTen[idA];
          }
          if (secF !== '' && secF != null) {
            const idF = key + '|' + String(secF).trim();
            if (ciTen[idF] != null && ciTen[idF] > 0) t2 = ciTen[idF];
          }
        }
        // Wind BM uses average presence
        const niW = Math.max(niA, niF);
        const hiW = Math.max(hiA, hiF) || heights[i] || 0;
        bmC += qC * di * windSpan * cosHalf * niW * hiW;
        // Angle BM: both sides
        if (!isTerminal) {
          bmT += (t1 * sinHalf) * niA * hiA + (t2 * sinHalf) * niF * hiF;
        }
        // Longitudinal: full T on terminal side; residual if both present; dead-end if only one side
        const onlyFore = niF > 0 && niA === 0;
        const onlyAft = niA > 0 && niF === 0;
        if (isTerminal || onlyFore) {
          bmT_long += niF * t2 * hiF;
        } else if (onlyAft) {
          bmT_long += niA * t1 * hiA; // terminating circuit on aft side
        } else {
          bmT_long += niF * t2 * hiF; // continuous — terminal formula uses fore; residual separate
        }
        if (!isTerminal && niA > 0 && niF > 0) {
          bmT_long_section += (t1 - t2) * cosHalf * ((niA + niF) / 2) * ((hiA + hiF) / 2);
        } else if (!isTerminal && onlyAft) {
          // circuit ends: treat residual as full dead-end already in bmT_long
        } else if (!isTerminal && onlyFore) {
          // circuit starts: dead-end on fore already in bmT_long
        }
      }
      // Circuit-terminating intermediate pole: mark as needing long capacity check
      if (isCommonMode && !isTerminal) {
        // if any circuit only on one side, elevate long demand (already in bmT_long)
      }

      const bmP = bmWindPole(poleHeightLocal, poleBreadthLocal, qPole);
      // BME = wind on equipment/transformer and moment due to weight
      // BME = A_tf·q_p·(h_tf+B/2) + W·9.810001·(1.325−depth/2)·0.001
      const tfRow = (typeof findEquipmentRow === 'function') ? findEquipmentRow(data.equipment || data.transformers || [], r.equipment || r.kva) : null;
      const equipParts = bmEquipParts(tfRow, poleHeight, qPole);
      const area = equipParts.area;
      const qP = (qPole || 865) / 1000;
      const bmE = equipParts.total; // wind BM + weight eccentricity BM

      // Spur / lateral circuits — Model W1
      // θ = angle to transverse (°): 0° = pure transverse; ±90° = pure longitudinal.
      // Tension:
      //   F_trans (kN) = T15+W × N × TF × cos(θ)   → full transverse at θ=0
      //   F_long  (kN) = T15+W × N × TF × sin(θ)   → sign(+)=additive to main-line long., sign(−)=opposite
      // Wind (spur wind span = Leq/2):
      //   Wind_long  = q_c · d · (Leq/2) · N · cos(θ) · H_att  → full longitudinal wind at θ=0
      //   Wind_trans = q_c · d · (Leq/2) · N · sin(θ) · H_att  → full transverse wind at θ=±90
      let spurMoment = 0;          // transverse BM from spur tension + spur wind (kN·m)
      let spurMomentLong = 0;      // longitudinal BM from spur tension + spur wind (kN·m, signed)
      const spurDetails = [];
      if (r.spur_circuits && r.spur_circuits.length) {
        r.spur_circuits.forEach((sp, si) => {
          if (!sp.enabled && !sp.conductor_code) return;
          if (sp.enabled === false) return; // explicit unchecked
          // legacy: spur_enabled true without per-circuit enabled → treat as enabled if conductor set
          if (sp.enabled !== true && !(r.spur_enabled && sp.conductor_code)) return;
          const code = sp.conductor_code;
          if (!code) return;
          const cond = (data.conductors || []).find(c => String(c.code) === String(code));
          const eqSp = num(sp.eq_span_m, 30);
          const ang = num(sp.angle_deg, 0);
          const tfPct = num(sp.tension_factor_pct, 100) / 100;
          const hAtt = num(sp.attach_h_m, 8);
          const nCondSp = Math.max(1, num(sp.n_conductors, (sp.voltage === 'LV' ? 1 : 3)));
          const cosA = Math.cos(toRad(ang));
          const sinA = Math.sin(toRad(ang));
          // --- Tension components ---
          const T1_kN = conductorTensionKN(cond, eqSp, spanTables); // per conductor
          const T_kN = T1_kN * nCondSp * tfPct;
          const F_trans = T_kN * cosA; // kN (transverse)
          const F_long  = T_kN * sinA; // kN (longitudinal, signed)
          const M_trans = F_trans * hAtt; // kN·m
          const M_long  = F_long  * hAtt; // kN·m signed
          // --- Wind components (Model W1), spur wind span = Leq/2 ---
          const Lw = Math.max(0, eqSp) / 2; // m
          const d = diaM(cond); // m
          const qc = (qCond != null ? qCond : (settings.wind_pressure_Nm2 || 575)) / 1000; // kN/m²
          // Wind force (kN) on N conductors over Lw, resolved by θ
          const Wforce = qc * d * Lw * nCondSp; // kN (full perpendicular force magnitude basis)
          const W_long  = Wforce * cosA; // full long wind at θ=0
          const W_trans = Wforce * sinA; // full trans wind at θ=±90
          const Mw_long  = W_long  * hAtt;
          const Mw_trans = W_trans * hAtt;
          spurMoment += M_trans + Mw_trans;
          spurMomentLong += M_long + Mw_long;
          spurDetails.push({
            i: si + 1, T_kN, F_trans, F_long, M: M_trans, M_long, Mw_trans, Mw_long,
            hAtt, ang, code, nCondSp, voltage: sp.voltage, Lw
          });
        });
      }

      const poleTopLoad = toPoleTop(bmC + bmT + bmP + bmE + spurMoment, poleHeightLocal);
      // BM_long (terminals) = Σ N·T·H + BMp + equipment wind − weight moment (TF opposite side)
      // BM_long (section / intermediate residual) = Σ (T1−T2)·cos(α/2)·N·H  [T at 15°C+wind]
      // + spur longitudinal (tension+wind). BM_p and equipment wind are NOT applied in longitudinal
      // for intermediate/section poles (only on terminals, and always in transverse BM).
      // Correctness: at an angle pole the along-bisector components are T·cos(α/2); when T1≠T2
      // (different section ruling spans) a net longitudinal force (T1−T2)·cos(α/2) remains. Terminals
      // keep the full dead-end longitudinal Σ N·T·H (unchanged).
      const bmLongFull = isTerminal
        ? (bmT_long + bmP + equipParts.windBm - equipParts.weightBm + Math.abs(spurMomentLong))
        : (Math.abs(bmT_long_section) + Math.abs(spurMomentLong)); // int/section: no BM_p / equip wind in long. (only residual T + spur long)
      // longLoadDaN / terminalLongLoad / sectionLongLoad computed after guy θ (below)
      const residualLoad = toPoleTop(bmC + bmP + bmE, poleHeightLocal);

      // IMPORTANT: all lever arms and capacity lookups use THIS pole's height (not union max PH)
      const PH = poleHeightLocal;

      // h_g from config: guy_h_m (intermediate) / tguy_h_m (terminal)
      const guyH_use = isTerminal ? (tguyH || 8.4) : (guyH || 8.4);
      const ell = Math.max(PH * 5 / 6 - 0.4, 0.5);
      // User-requested θ (only intermediate/section). Applied only if primary rec is guyed (see below).
      const thetaUser = (!isTerminal && r.guy_theta_enabled) ? num(r.guy_theta_deg, 0) : 0;
      // Per-pole guy wire angle to the pole (°); falls back to Design Parameters default
      const guyAnglePole = num(r.guy_pole_angle_deg, guyAngle);

      // ----- Pass 1: always compute with θ = 0 (pure transverse guy) -----
      let guyLoad = 0;
      let bmGuyForG = 0;
      if (isTerminal) {
        bmGuyForG = bmT_long;
        guyLoad = guyWireLoadDaN(bmT_long, guyH_use, guyAnglePole, 0);
      } else {
        bmGuyForG = Math.max(bmT || 0, Math.abs(bmT_long_section) || 0);
        if (bmGuyForG > 0) guyLoad = guyWireLoadDaN(bmGuyForG, guyH_use, guyAnglePole, 0);
      }
      // Terminal long load always includes wind pole + equipment (θ not applicable)
      // Intermediate/section: residual section long + BM_p + equip wind + spur long (confirmed)
      let longLoadDaN = 0;
      if (isTerminal) {
        longLoadDaN = toPoleTop(bmLongFull, PH);
      } else {
        // residual section long + spur longitudinal only (no BM_p / equip wind in long. for int/section)
        const bmLongInt = Math.abs(bmT_long_section) + Math.abs(spurMomentLong);
        longLoadDaN = (bmLongInt / ell) * 100;
      }
      let flGuyDaN = 0, bmLongGuy = 0;
      let thetaGuy = 0; // effective θ used in final numbers (0 unless guyed + user θ)
      let excessiveGuyTheta = false;

      // Unguyed candidates from transverse pole-top only (θ=0 path) — no 2x for final rec
      let unguyed = pickUnguyed(PH, poleTopLoad, { allow2x: true });
      if (unguyed && longLoadDaN > 0 && longLoadDaN > unguyed.cap * 0.25) unguyed = null;
      let unguyedLabel = unguyed ? unguyed.label : 'X';
      let unguyedNo2x = pickUnguyed(PH, poleTopLoad, { allow2x: false });
      if (unguyedNo2x && longLoadDaN > 0 && longLoadDaN > unguyedNo2x.cap * 0.25) unguyedNo2x = null;

      // Guy from construction data: lightest with working_load >= guy wire load (L→M→H→2H…)
      const guyList = (data.guy_wires || []).slice()
        .sort((a, b) => num(a.working_load_daN, 0) - num(b.working_load_daN, 0));
      let selectedGuy = null;
      for (const g of guyList) {
        if (num(g.working_load_daN, 0) >= guyLoad) { selectedGuy = g; break; }
      }
      let gCls = 'L';
      if (selectedGuy) {
        gCls = String(selectedGuy.code);
      } else if (guyList.length) {
        const hGuy = guyList.find(g => String(g.code).toUpperCase() === 'H') || guyList[guyList.length - 1];
        const hCap = num(hGuy.working_load_daN, 5600);
        const n = Math.max(1, Math.ceil(guyLoad / Math.max(hCap, 1)));
        gCls = n <= 1 ? String(hGuy.code) : (n + 'H');
        selectedGuy = { code: gCls, working_load_daN: n * hCap };
      } else {
        if (guyLoad <= 2000) gCls = 'L';
        else if (guyLoad <= 3500) gCls = 'M';
        else if (guyLoad <= 5600) gCls = 'H';
        else gCls = Math.ceil(guyLoad / 5600) + 'H';
      }

      // --- Rec. Guy/Unguy: pole from residual transverse + guy arrangement only ---
      let guyed = pickGuyed(poleHeight, residualLoad, gCls);
      let mostEconomic = unguyedLabel, recommended = unguyedLabel;
      let bucklingKN = 0, bucklingDemand = 0, bucklingOK = true, guyArrLabel = gCls || '';
      let guyedBeforeBuckling = '';   // same as Rec. Guy/Unguy (transverse-only)
      let recommendedOnBuckling = '—';
      let bucklingCompliance = '—';  // Pass / Fail for Rec. Guy/Unguy vs V_req

      const tfKg = tfWeight(r.equipment || r.kva, data.equipment || data.transformers);

      // --- Conductor vertical force (kN) from catenary at 15 °C+wind tension (same T as BMT) ---
      // Positive = down-pull on pole; negative = uplift. Clearance still uses T65 only.
      // H is ALWAYS per-conductor tension (kN) from the span–tension table — never N×T.
      let Vcond_kN = 0;
      let weightSpanEff = weightSpan; // diagnostic; updated from catenary shares
      let wSum = 0; // N/m of conductors attached to this pole
      const elevThis = num(r.abs_elev, 0);
      // Next pole elev: prefer next row's abs_elev when sequential; else Elev Δ on this pole
      let elevNext = elevThis + (r.elev_delta || 0);
      if (idx < rows.length - 1 && Number(rows[idx + 1].aft) > 0) {
        elevNext = num(rows[idx + 1].abs_elev, elevNext);
      }
      let elevPrev = elevThis;
      if (idx > 0) elevPrev = num(rows[idx - 1].abs_elev, elevThis);
      // Ruling-span tensions per section for H (per conductor)
      const eqFore = sectionEq[r.section] || eqSpan || 0;
      const eqAftSpan = (idx > 0 && sectionEq[rows[idx - 1].section] != null)
        ? sectionEq[rows[idx - 1].section] : eqFore;
      for (let i = 0; i < nHH + nH + nL; i++) {
        const sc = stageCond[i];
        if (!sc) continue;
        const ni = ns[i] || 0;
        if (!ni) continue;
        const Wkg = unitWeight(sc);
        const band = i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L');
        const loc = band === 'HH' ? i : (band === 'H' ? i - nHH : i - nHH - nH);
        const insDesc = band === 'HH' ? (settings.insulator_HH_desc || '') : (band === 'H' ? (settings.insulator_H_desc || '') : '');
        const insHgt = band === 'L' ? 0 : insulatorNominalHeightM(data, insDesc, band === 'HH' ? 33 : 11);
        const attachH = (heights[i] || 0) + insHgt;
        // Per-conductor T at 15°C+wind from tables (bypass any corrupted aggregate)
        const facF = Math.max(0.05, factorFor(String(r.section), band, loc));
        const facA = (idx > 0)
          ? Math.max(0.05, factorFor(String(rows[idx - 1].section), band, loc))
          : facF;
        let tFore = conductorTensionKN(sc, eqFore, spanTables) * facF;
        let tAft = conductorTensionKN(sc, eqAftSpan, spanTables) * facA;
        // Guard: if stage array carries an N×T aggregate, reduce to per-conductor
        const tStage2 = stageT2[i] != null ? Number(stageT2[i]) : null;
        const tStage1 = stageT1[i] != null ? Number(stageT1[i]) : null;
        if (tStage2 != null && tStage2 > 0 && tFore > 0 && Math.abs(tStage2 / tFore - ni) < 0.05)
          tFore = tStage2 / ni;
        else if (tStage2 != null && tStage2 > 0 && tFore > 0 && tStage2 < tFore * 1.5)
          tFore = tStage2; // trust stage when it matches per-conductor
        if (tStage1 != null && tStage1 > 0 && tAft > 0 && Math.abs(tStage1 / tAft - ni) < 0.05)
          tAft = tStage1 / ni;
        else if (tStage1 != null && tStage1 > 0 && tAft > 0 && tStage1 < tAft * 1.5)
          tAft = tStage1;
        // Fore span: this pole is START
        if (r.fore > 0) {
          const ends = catenaryVerticalEnds(sc, tFore, r.fore, elevThis, elevNext, attachH, attachH);
          Vcond_kN += ni * ends.V_start_kN;
        }
        // Aft span: this pole is END
        if (r.aft > 0) {
          const ends = catenaryVerticalEnds(sc, tAft, r.aft, elevPrev, elevThis, attachH, attachH);
          Vcond_kN += ni * ends.V_end_kN;
        }
        if (r.fore > 0 || r.aft > 0) wSum += ni * Wkg * 9.81;
      }
      // Spur circuit vertical: N * W * eq_span * g / 1000 (down-pull)
      let Vspur_kN = 0;
      if (r.spur_circuits && r.spur_circuits.length) {
        r.spur_circuits.forEach(sp => {
          if (sp.enabled === false) return;
          if (!(sp.enabled === true || (r.spur_enabled && sp.conductor_code))) return;
          if (!sp.conductor_code) return;
          const sc = (data.conductors || []).find(c => String(c.code) === String(sp.conductor_code));
          const Wkg = unitWeight(sc);
          const nSp = num(sp.n_conductors, sp.voltage === 'LV' ? 1 : 3) || 1;
          const Leq = num(sp.eq_span_m, 30) || 30;
          Vspur_kN += nSp * Wkg * Leq * 9.81 / 1000;
        });
      }
      Vcond_kN += Vspur_kN;
      // Effective weight span from catenary (signed: − means net uplift). Flat → ≈ (L_aft+L_fore)/2.
      if (wSum > 1e-9) weightSpanEff = (Vcond_kN * 1000) / wSum;
      else weightSpanEff = weightSpan;

      // Vertical load for guyed / buckling: conductor vertical (catenary) + guy vertical + equipment
      const guyVert_kN = (guyLoad || 0) * Math.cos(toRad(guyAnglePole || 30)) / 100;
      const Veq_kN = (tfKg || 0) * 9.81 / 1000;
      const V = Vcond_kN + guyVert_kN + Veq_kN;
      bucklingDemand = Math.abs(V) * 2.5; // capacity vs magnitude; uplift still needs axial capacity

      if (guyed || residualLoad > 0 || guyLoad > 0) {
        const base = (guyed && guyed.base) ? guyed.base : '200';
        const cls = gCls;
        // Rec. Guy/Unguy = transverse residual class + guy code (NOT upsized for buckling)
        guyedBeforeBuckling = PH + '/' + base + ' ' + cls;
        const capTransverse = bucklingCapacityKN(PH, base, data.capacities);
        bucklingKN = capTransverse; // capacity of the transverse-selected class
        bucklingOK = capTransverse >= bucklingDemand;
        bucklingCompliance = bucklingOK ? 'Pass' : 'Fail';
        guyArrLabel = cls;

        // Upsize only for Rec. on Buckling when Fail
        let baseB = base;
        let capB = capTransverse;
        const order = ['200', '350', '500', '850', '1200'];
        let bi = order.indexOf(baseB);
        if (bi < 0) bi = 0;
        while (capB < bucklingDemand && bi < order.length - 1) {
          bi++; baseB = order[bi];
          capB = bucklingCapacityKN(PH, baseB, data.capacities);
        }

        const buckOkFinal = capB >= bucklingDemand;
        recommendedOnBuckling = buckOkFinal
          ? (PH + '/' + baseB + ' ' + cls)
          : ('X (need >' + bucklingDemand.toFixed(0) + ' kN)');

        // Keep "guyed" object as transverse-only selection for Rec. Guy/Unguy column
        if (!guyed) guyed = { label: base + ' ' + cls, base, guyClass: cls };
        else guyed = { ...guyed, label: base + ' ' + cls, base, guyClass: cls };
      }

      // Main pole class for strut association (residual capacity, non-2x preferred)
      let strutMain = '200';
      {
        const mainCand = pickUnguyed(PH, residualLoad > 0 ? residualLoad : poleTopLoad, { allow2x: false })
          || pickUnguyed(PH, residualLoad > 0 ? residualLoad : poleTopLoad, { allow2x: true });
        if (mainCand) strutMain = String(mainCand.label).replace(/\s*U\s*$/i, '').replace(/^2x/i, '');
        else if (guyed && guyed.base) strutMain = guyed.base;
      }
      const bmTensionForStrut = isTerminal ? bmT_long : bmT;
      const poleTopLoadStrut = toPoleTop(bmTensionForStrut, PH);
      const struttedLabel = formatStrutted(strutMain, poleTopLoadStrut);

      // Final Recommended (θ=0 first pass): never 2x butted. Prefer single unguyed → guyed/buckling → strutted.
      if (unguyedNo2x) {
        mostEconomic = unguyedNo2x.label;
        recommended = unguyedNo2x.label;
      } else if (recommendedOnBuckling && recommendedOnBuckling !== '—' && !/^X\b/i.test(recommendedOnBuckling) && !/2x/i.test(recommendedOnBuckling)) {
        recommended = recommendedOnBuckling;
        mostEconomic = recommendedOnBuckling;
      } else if (struttedLabel && struttedLabel !== 'X') {
        recommended = struttedLabel;
        mostEconomic = struttedLabel;
      } else {
        mostEconomic = 'X';
        recommended = 'X';
      }

      // ----- Pass 2: apply user θ only if primary recommendation is GUYED (not unguyed) -----
      // If unguyed was selected, θ is irrelevant — leave loads at θ=0 values.
      let guyLoadTrans = guyLoad; // transverse-direction guy (daN)
      let guyLoadLong = 0;        // longitudinal-direction guy (daN) — section residual / dual guy
      let guyArrTrans = gCls || '';
      let guyArrLong = '';
      const primaryIsUnguyed = !!(unguyedNo2x && recommended === unguyedNo2x.label);
      const primaryIsGuyed = !primaryIsUnguyed && !isTerminal && Math.abs(thetaUser) > 1e-9 &&
        (recommendedOnBuckling && recommendedOnBuckling !== '—' || /\d+\s*\/\s*\d+/.test(String(recommended)) || guyLoad > 0);
      if (primaryIsGuyed) {
        thetaGuy = thetaUser;
        // Recompute guy tension with θ
        if (bmGuyForG > 0) guyLoad = guyWireLoadDaN(bmGuyForG, guyH_use, guyAnglePole, thetaGuy);
        guyLoadTrans = guyLoad;
        flGuyDaN = guyLongForceDaN(guyLoad, guyAnglePole, thetaGuy);
        bmLongGuy = (flGuyDaN / 100) * guyH_use;
        const bmLongCombined = Math.abs(bmT_long_section) + Math.abs(bmLongGuy)
          + Math.abs(spurMomentLong || 0);
        longLoadDaN = (bmLongCombined / ell) * 100;
        // θ-pass: only longitudinal 25% rule (transverse already taken by guy at θ=0).
        const nom = (typeof NOMINAL !== 'undefined' && NOMINAL[PH]) ? NOMINAL[PH] : [];
        let foundLong = null;
        const residualNeed = residualLoad || 0;
        for (const c of nom) {
          if (!c || /2x/i.test(String(c.label || ''))) continue;
          if (longLoadDaN <= c.cap * 0.25 && c.cap >= residualNeed) { foundLong = c; break; }
        }
        if (!foundLong) {
          for (const c of nom) {
            if (!c || /2x/i.test(String(c.label || ''))) continue;
            if (longLoadDaN <= c.cap * 0.25) { foundLong = c; break; }
          }
        }
        if (foundLong) {
          const base = String(foundLong.label).replace(/\s*U\s*$/i, '').trim();
          let gCls2 = gCls;
          const guyList2 = (data.guy_wires || []).slice().sort((a, b) => num(a.working_load_daN, 0) - num(b.working_load_daN, 0));
          let selG = null;
          for (const g of guyList2) {
            if (num(g.working_load_daN, 0) >= guyLoad) { selG = g; break; }
          }
          if (selG) gCls2 = String(selG.code);
          recommended = PH + '/' + base + ' ' + gCls2;
          mostEconomic = recommended;
          gCls = gCls2;
          guyArrTrans = gCls2;
          guyArrLabel = gCls2;
          excessiveGuyTheta = false;
        } else {
          excessiveGuyTheta = true;
          recommended = 'excessive guy wire transverse angle';
          mostEconomic = 'excessive guy wire transverse angle';
        }
      } else {
        thetaGuy = 0; // unguyed primary → ignore user θ for reported loads
      }

      // ----- Pass 3: section / intermediate residual longitudinal (T1≠T2) — 25% rule or long guy -----
      // Applies even when θ=0. Significant section tension difference (e.g. Line Tension Factors)
      // produces BM_long_section and P_long. Pole must take P_long ≤ 25% of capacity, else:
      //   upgrade non-2x class, or add a longitudinal guy (same formula as terminal).
      if (!isTerminal && !excessiveGuyTheta && longLoadDaN > 1e-6) {
        // Capacity of currently recommended base (strip guy suffix / U)
        const parseBaseCap = (lab) => {
          const m = String(lab || '').match(/(\d+)\s*\/\s*(\d+)/);
          if (!m) return null;
          const capWant = Number(m[2]);
          const nom = (typeof NOMINAL !== 'undefined' && NOMINAL[PH]) ? NOMINAL[PH] : [];
          const hit = nom.find(c => c && Math.abs(c.cap - capWant) < 1 && !/2x/i.test(String(c.label || '')));
          return hit || { label: m[2] + ' U', cap: capWant };
        };
        let baseInfo = parseBaseCap(recommended);
        if (!baseInfo && unguyedNo2x) baseInfo = unguyedNo2x;
        const nom = (typeof NOMINAL !== 'undefined' && NOMINAL[PH]) ? NOMINAL[PH] : [];
        const longOk = baseInfo && longLoadDaN <= baseInfo.cap * 0.25 + 1e-9;
        if (!longOk) {
          // Try higher non-2x class for self-sustain of longitudinal
          let foundLong = null;
          for (const c of nom) {
            if (!c || /2x/i.test(String(c.label || ''))) continue;
            if (longLoadDaN <= c.cap * 0.25) { foundLong = c; break; }
          }
          if (foundLong) {
            const base = String(foundLong.label).replace(/\s*U\s*$/i, '').trim();
            // Keep transverse guy if primary was guyed, else unguyed U
            if (primaryIsUnguyed || (unguyedNo2x && String(recommended).includes('U'))) {
              recommended = foundLong.label;
              mostEconomic = foundLong.label;
              guyArrLabel = '';
              guyArrTrans = '';
            } else {
              // stay guyed transversely with upgraded base
              let gCls2 = guyArrTrans || gCls || '';
              if (bmGuyForG > 0) {
                const gl = guyWireLoadDaN(bmGuyForG, guyH_use, guyAnglePole, thetaGuy);
                guyLoadTrans = gl;
                guyLoad = gl;
                const guyList2 = (data.guy_wires || []).slice().sort((a, b) => num(a.working_load_daN, 0) - num(b.working_load_daN, 0));
                for (const g of guyList2) {
                  if (num(g.working_load_daN, 0) >= gl) { gCls2 = String(g.code); break; }
                }
              }
              recommended = PH + '/' + base + ' ' + gCls2;
              mostEconomic = recommended;
              gCls = gCls2;
              guyArrTrans = gCls2;
              guyArrLabel = gCls2;
            }
          } else {
            // No self-sustain class at 25% of max pole capacity: provide longitudinal guy
            // (only when residual long + spur long + BM_p + equip wind cannot be self-sustained)
            const bmLongForGuy = Math.abs(bmT_long_section) + Math.abs(bmLongGuy || 0)
              + Math.abs(spurMomentLong || 0);
            guyLoadLong = guyWireLoadDaN(bmLongForGuy, guyH_use, guyAnglePole, 0); // θ=0 in pure longitudinal plane
            const guyListL = (data.guy_wires || []).slice().sort((a, b) => num(a.working_load_daN, 0) - num(b.working_load_daN, 0));
            let selL = null;
            for (const g of guyListL) {
              if (num(g.working_load_daN, 0) >= guyLoadLong) { selL = g; break; }
            }
            guyArrLong = selL ? String(selL.code) : 'X';
            // Ensure transverse guy exists when angle/transverse needs it
            if (!(guyArrTrans || gCls) && (bmT > 0 || residualLoad > 0)) {
              if (bmGuyForG > 0) {
                guyLoadTrans = guyWireLoadDaN(bmGuyForG, guyH_use, guyAnglePole, 0);
                guyLoad = guyLoadTrans;
                for (const g of guyListL) {
                  if (num(g.working_load_daN, 0) >= guyLoadTrans) { guyArrTrans = String(g.code); break; }
                }
              }
            }
            if (!guyArrTrans) guyArrTrans = gCls || '';
            // Merged arrangement e.g. M(T), H(L)
            const parts = [];
            if (guyArrTrans) parts.push(guyArrTrans + '(T)');
            if (guyArrLong) parts.push(guyArrLong + '(L)');
            guyArrLabel = parts.join(', ');
            // Pole base: keep current recommended base or lightest that covers residual transverse
            let base = '';
            const m = String(recommended || '').match(/\d+\s*\/\s*(\d+)/);
            if (m) base = m[1];
            else if (baseInfo) base = String(baseInfo.cap);
            else base = '500';
            recommended = PH + '/' + base + ' ' + guyArrLabel;
            mostEconomic = recommended;
            gCls = guyArrLabel;
            // Longitudinal load still reported; capacity check relaxed by long guy (like terminal)
          }
        }
      }
      // Final guy arrangement string for results
      if (!guyArrLabel) {
        if (guyArrTrans && guyArrLong) guyArrLabel = guyArrTrans + '(T), ' + guyArrLong + '(L)';
        else if (guyArrTrans) guyArrLabel = guyArrTrans;
        else if (guyArrLong) guyArrLabel = guyArrLong + '(L)';
      }

// Alternatives in separate columns (not equal to final Recommended)
      const altList = [];
      const recN = String(recommended).replace(/\s+/g, ' ').trim();
      const pushAlt = (label, kind) => {
        if (!label || label === 'X' || label === '—' || /^X\b/i.test(String(label))) return;
        const n = String(label).replace(/\s+/g, ' ').trim();
        if (n === recN) return;
        if (altList.some(a => a.startsWith(n))) return;
        altList.push(n + ' (' + kind + ')');
      };
      pushAlt(unguyedLabel, 'unguyed');
      if (recommendedOnBuckling && recommendedOnBuckling !== '—') pushAlt(recommendedOnBuckling, 'guyed');
      pushAlt(struttedLabel, 'strutted');
      const alternative1 = altList[0] || '—';
      const alternative2 = altList[1] || '—';
      const alternatives = altList.length ? altList.join('; ') : '—';

      // Foundation design for final Recommended pole
      const isGuyedOrStrutRec = /S\b/.test(String(recommended)) || /\d+\s*\/\s*\d+/.test(String(recommended))
        || /\b[LMH]\b/.test(String(recommended)) || /2H|\dH/.test(String(recommended));
      const isUnguyedRec = /^\s*(2x)?\d+\s*U\s*$/i.test(String(recommended));
      const fd = computeFoundation({
        poleHeight, recommended, isTerminal,
        isGuyedOrStrut: isGuyedOrStrutRec && !isUnguyedRec,
        heights, ns, nHH, nH, nL, stageCond, stageT1, stageT2,
        windSpan, weightSpan: weightSpanEff, angleDeg: r.angle, qCond, qPole,
        guyLoadDaN: (isGuyedOrStrutRec && !isUnguyedRec) ? guyLoad : 0,
        guyAngleDeg: guyAnglePole, tfWeightKg: tfKg,
        tfArea: (typeof area !== 'undefined' ? area : 0),
        equipment: r.equipment || '',
        tfKva: r.kva,
        conductorVertical_kN: Vcond_kN,
        soilClass: r.soil, data
      });

      // Insulators: angle table for intermediate; TEN** (with voltage) on terminal / section poles
      // Criteria from Design Parameters (Top-tie max / Side-tie max):
      //   α ≤ ttieMax → Selected+TTIE; ttieMax < α ≤ stieMax → Selected+STIE; α > stieMax → 2×Selected+2STIE
      const selInsHH = (settings.insulator_HH_desc || settings.insulator_hh || '').trim();
      const selInsH = (settings.insulator_H_desc || settings.insulator_h || '').trim();
      const deadEnd = !!(isTerminal || isSectionPole);
      let insHH = '', insH = '', tie = '', tieHH = '', tieH = '';
      let insHH_detail = '', insH_detail = '';
      let insNoteHH = '', insNoteH = '';
      let R_HH = null, R_H = null, Rre_HH = null, Rre_H = null;
      const insRows = data.insulators || [];
      const cantOf = (desc) => {
        const hit = insRows.find(x => String(x.description) === String(desc));
        return hit ? num(hit.cantilever_strength_kN, 0) : 0;
      };
      // Representative stage index for each band (first stage of band)
      const idxHH = 0;
      const idxH = nHH;
      if (nHH > 0) {
        const sc = stageCond[idxHH];
        // Per-conductor T only (never N×T) for pin resultant
        let T1h = stageT1[idxHH], T2h = stageT2[idxHH];
        const rawT = sc ? conductorTensionKN(sc, eqSpan, spanTables) : 0;
        if (rawT > 0 && T2h > 0 && Math.abs(T2h / rawT - (ns[idxHH] || 1)) < 0.08) {
          T1h = T1h / (ns[idxHH] || 1); T2h = T2h / (ns[idxHH] || 1);
        }
        const r33 = selectInsulatorByAngle(r.angle, selInsHH, '33kV', deadEnd, ttieMax, stieMax, {
          T1_kN: T1h, T2_kN: T2h,
          qCond, dia_m: diaM(sc), windSpan, cantilever_kN: cantOf(selInsHH)
        });
        insHH = r33.insulator;
        insHH_detail = r33.detail;
        tieHH = r33.tie;
        insNoteHH = r33.note || '';
        R_HH = r33.R_kN;
        Rre_HH = r33.R_recalc_kN;
        if (insNoteHH) insHH = insHH + ' ⚠';
      }
      if (nH > 0) {
        const sc = stageCond[idxH];
        let T1h = stageT1[idxH], T2h = stageT2[idxH];
        const rawT = sc ? conductorTensionKN(sc, eqSpan, spanTables) : 0;
        if (rawT > 0 && T2h > 0 && Math.abs(T2h / rawT - (ns[idxH] || 1)) < 0.08) {
          T1h = T1h / (ns[idxH] || 1); T2h = T2h / (ns[idxH] || 1);
        }
        const r11 = selectInsulatorByAngle(r.angle, selInsH, '11kV', deadEnd, ttieMax, stieMax, {
          T1_kN: T1h, T2_kN: T2h,
          qCond, dia_m: diaM(sc), windSpan, cantilever_kN: cantOf(selInsH)
        });
        insH = r11.insulator;
        insH_detail = r11.detail;
        tieH = r11.tie;
        insNoteH = r11.note || '';
        R_H = r11.R_kN;
        Rre_H = r11.R_recalc_kN;
        if (insNoteH) insH = insH + ' ⚠';
      }
      // Combined tie column (legacy): show if any intermediate circuit has a tie
      tie = [tieHH, tieH].filter(Boolean).join(' / ') || '';
      const insulator_note = [insNoteHH, insNoteH].filter(Boolean).join(' | ');

      // --- Max sag @ 65 °C and stringing sag @ 27 °C (per stage) ---
      // Flat: span–tension table + (L/Leq)².
      // Unequal/survey: section T65 (T27@Leq → state-change @ Leq) + catenary on actual span geometry.
      const eqS = sectionEq[r.section] || eqSpan || 0;
      const Lfore = r.fore > 0 ? r.fore : (r.aft > 0 ? r.aft : 0);
      const hasSurvey = !!(r.survey_points && r.survey_points.length);
      // This span is “elevated” if Elev Δ on this pole ≠ 0 (defines next pole elev) or survey exists
      const spanHasElev = Math.abs(r.elev_delta || 0) > 1e-6 || hasSurvey;
      const useUnequal = !!(sectionUnequal[String(r.section)] || hasSurvey);
      // elevA = this pole abs elev; elevB = elevA + Elev Δ on THIS pole (elevation of next pole)
      const elevA = num(r.abs_elev, 0);
      const elevB = elevA + (r.elev_delta || 0);
      const sag65 = [];
      const sag27 = [];
      const T65_kN_stages = [];
      const stageProfiles = [];
      let lowestClearance = null;
      let minClrX = null;
      let maxTerrainH = Math.max(elevA, elevB);
      const t65Sec = sectionT65[r.section] || [];

      for (let i = 0; i < nStages; i++) {
        const sc = stageCond[i];
        const s27eq = conductorSagM(sc, eqS, spanTables, 'sag_27_m');
        const bandS = i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L');
        const locS = bandS === 'HH' ? i : (bandS === 'H' ? i - nHH : i - nHH - nH);
        const facS = Math.max(0.05, factorFor(r.section, bandS, locS));
        // Line Tension Factor: lower tension → higher stringing sag (~ inverse)
        sag27.push(scaleSag(s27eq, Lfore, eqS) / facS);

        // Always build catenary profiles (equal supports when flat; unequal when Elev Δ / survey present)
        {
          const T65_N = t65Sec[i];
          if (!sc || Lfore <= 0 || T65_N == null || !(T65_N > 0)) {
            const s65eq = conductorSagM(sc, eqS, spanTables, 'sag_65_m');
            sag65.push(scaleSag(s65eq, Lfore, eqS));
            T65_kN_stages.push(null);
            stageProfiles.push(null);
          } else {
            T65_kN_stages.push(T65_N / 1000);
            const band = i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L');
            const insDesc = band === 'HH' ? (settings.insulator_HH_desc || '') : (band === 'H' ? (settings.insulator_H_desc || '') : '');
            const insHgt = band === 'L' ? 0 : insulatorNominalHeightM(data, insDesc, band === 'HH' ? 33 : 11);
            const attachH = (heights[i] || 0) + insHgt; // attachment = cross-arm height + insulator nominal height
            const cat = catenaryUnequal(sc, T65_N, Lfore, elevA, elevB, attachH, attachH, r.survey_points || []);
            sag65.push(cat.maxSag_m);
            stageProfiles.push(cat);
            if (cat.maxTerrain_m > maxTerrainH) maxTerrainH = cat.maxTerrain_m;
            if (i === bottomStageIdx) {
              // Lowest circuit-to-ground = min of (Y_cond − Y_ground) along the span
              lowestClearance = cat.minClearance_m;
              minClrX = cat.minClearance_x;
            }
          }
        }
      }

      // Plot spans that have catenary profiles (all spans when T65 available)
      let spanPlot = null;
      if (Lfore > 0 && stageProfiles.some(p => p && p.samples && p.samples.length)) {
        const ref = stageProfiles.find(p => p && p.samples) || stageProfiles[bottomStageIdx];
        const xs = (ref && ref.samples) ? ref.samples.map(s => s.x) : [];
        const terrain = (ref && ref.samples) ? ref.samples.map(s => s.yGnd) : [];
        const circuits = stageProfiles.map((p, i) => {
          if (!p || !p.samples) return null;
          return {
            label: stageVoltLabels[i] || ('C' + (i + 1)),
            y: p.samples.map(s => s.yCond)
          };
        });
        // Attachment heights at poles for annotation (config height + insulator nominal height for HV)
        const poleHeightsA = stageProfiles.map((p, i) => {
          if (!p) return null;
          const band = stageBands[i];
          const insDesc = band === 'HH' ? (settings.insulator_HH_desc || '') : (band === 'H' ? (settings.insulator_H_desc || '') : '');
          const insH = band === 'L' ? 0 : insulatorNominalHeightM(data, insDesc, band === 'HH' ? 33 : 11);
          return elevA + (heights[i] || 0) + insH;
        });
        const poleHeightsB = stageProfiles.map((p, i) => {
          if (!p) return null;
          const band = stageBands[i];
          const insDesc = band === 'HH' ? (settings.insulator_HH_desc || '') : (band === 'H' ? (settings.insulator_H_desc || '') : '');
          const insH = band === 'L' ? 0 : insulatorNominalHeightM(data, insDesc, band === 'HH' ? 33 : 11);
          return elevB + (heights[i] || 0) + insH;
        });
        spanPlot = {
          L: Lfore, elevA, elevB, maxTerrain_m: maxTerrainH,
          xs, terrain, circuits,
          poleHeightsA, poleHeightsB,
          minClearance_m: lowestClearance,
          minClearance_x: minClrX,
          section: r.section, pole_no: r.pole_no,
          hasSurvey: hasSurvey,
          elevDelta: r.elev_delta || 0
        };
      }

      // Ground clearance — include insulator height on bottom circuit attachment for HV
      const bottomStageBand = stageBands[bottomStageIdx] || 'L'; // HH / H / L
      const bottomInsDesc = bottomStageBand === 'HH' ? (settings.insulator_HH_desc || '') : (bottomStageBand === 'H' ? (settings.insulator_H_desc || '') : '');
      const bottomInsH = bottomStageBand === 'L' ? 0 : insulatorNominalHeightM(data, bottomInsDesc, bottomStageBand === 'HH' ? 33 : 11);
      const bottomH = (heights[bottomStageIdx] || 0) + bottomInsH;
      const bottomSag65 = sag65[bottomStageIdx] || 0;
      if (lowestClearance == null) {
        // Flat: attachment height − sag
        lowestClearance = bottomH - bottomSag65;
      }
      const env = r.span_environment || 'along or across any road or street';
      // bottomBand (LV/11kV/33kV) is section-level from bottomMostBand — used for ground clearance table
      let applClear;
      if ((settings.clearance_source || 'regulatory') === 'user') {
        const ug = settings.user_gc || {};
        applClear = num(ug[bottomBand], 0) || applicableGroundClearance(data, bottomBand, env);
      } else {
        applClear = applicableGroundClearance(data, bottomBand, env);
      }
      const groundOk = lowestClearance > applClear;

      // Circuit-to-circuit: ALWAYS min of (Y_upper − Y_lower) along the span from catenary profiles
      // (equal-support catenary when flat; unequal when Elev Δ / survey present)
      const ccPairs = [];
      for (let i = 0; i < nStages - 1; i++) {
        let req;
        if ((settings.clearance_source || 'regulatory') === 'user') {
          const uLab = stageBands[i] === 'HH' ? '33kV' : (stageBands[i] === 'H' ? '11kV' : 'LV');
          const lLab = stageBands[i + 1] === 'HH' ? '33kV' : (stageBands[i + 1] === 'H' ? '11kV' : 'LV');
          const uc = settings.user_cc || {};
          req = num(uc[uLab + '|' + lLab], null);
          if (req == null) req = num(uc[lLab + '|' + uLab], null);
          if (req == null) req = circuitVerticalReq(data, stageBands[i], stageBands[i + 1]);
        } else {
          req = circuitVerticalReq(data, stageBands[i], stageBands[i + 1]);
        }
        let minVert;
        let minVertX = null;
        const pu = stageProfiles[i], pl = stageProfiles[i + 1];
        if (pu && pl && pu.samples && pl.samples && pu.samples.length === pl.samples.length) {
          minVert = Infinity;
          for (let k = 0; k < pu.samples.length; k++) {
            const dv = pu.samples[k].yCond - pl.samples[k].yCond;
            if (dv < minVert) { minVert = dv; minVertX = pu.samples[k].x; }
          }
          if (!Number.isFinite(minVert)) minVert = 0;
        } else {
          // Fallback if profiles unavailable
          const bandU = stageBands[i], bandL = stageBands[i + 1];
          const insDescU = bandU === 'HH' ? (settings.insulator_HH_desc || '') : (bandU === 'H' ? (settings.insulator_H_desc || '') : '');
          const insDescL = bandL === 'HH' ? (settings.insulator_HH_desc || '') : (bandL === 'H' ? (settings.insulator_H_desc || '') : '');
          const insHu = bandU === 'L' ? 0 : insulatorNominalHeightM(data, insDescU, bandU === 'HH' ? 33 : 11);
          const insHl = bandL === 'L' ? 0 : insulatorNominalHeightM(data, insDescL, bandL === 'HH' ? 33 : 11);
          const Hu = (heights[i] || 0) + insHu, Hl = (heights[i + 1] || 0) + insHl;
          const su = sag65[i] || 0, sl = sag65[i + 1] || 0;
          minVert = (Hu - su) - (Hl - sl);
        }
        const ok = minVert >= req;
        ccPairs.push({
          from: i, to: i + 1,
          fromLabel: stageVoltLabels[i], toLabel: stageVoltLabels[i + 1],
          clearance_m: minVert, required_m: req, ok, at_x: minVertX
        });
      }
      const allCcOk = ccPairs.length === 0 || ccPairs.every(p => p.ok);

      // ----- Structure clearances (separate from ground) -----
      // Structure top height is above local ground at x; conductor height from bottom-stage profile.
      const structPts = Array.isArray(r.structure_points) ? r.structure_points : [];
      let structureRows = [];
      let structure_ok = true;
      let structApplClear = null; // from Structure/building/tree clearances table only
      try {
        const bandLab = bottomBand || '11kV';
        const scRows = (data.structure_clearances || []).filter(s => {
          const vb = String(s.voltage_band || s.voltage || '');
          return !vb || vb === bandLab || vb.includes(bandLab.replace('kV',''));
        });
        if (scRows.length) {
          const v = num(scRows[0].min_clearance_m != null ? scRows[0].min_clearance_m
            : (scRows[0].vertical_m != null ? scRows[0].vertical_m : scRows[0].clearance_m), null);
          if (v != null && v > 0) structApplClear = v;
        } else {
          structApplClear = null; // no table value — only show when structures exist and table has a value
        }
      } catch (e) {}
      const bottomProf = stageProfiles[bottomStageIdx];
      const structLimit = (structApplClear != null && structApplClear > 0) ? structApplClear : applClear;
      structPts.forEach((sp, si) => {
        const x = num(sp.x, 0);
        const hTop = num(sp.h, 0); // structure top above ground
        // Local ground elev at x from terrain samples or linear elevA→elevB
        let yGnd = elevA;
        if (bottomProf && bottomProf.samples && bottomProf.samples.length) {
          let best = bottomProf.samples[0];
          let bd = Math.abs(best.x - x);
          bottomProf.samples.forEach(s => {
            const d = Math.abs(s.x - x);
            if (d < bd) { bd = d; best = s; }
          });
          yGnd = best.yGnd;
        } else if (Lfore > 0) {
          yGnd = elevA + (elevB - elevA) * (x / Lfore);
        }
        const yStructTop = yGnd + hTop;
        // Conductor height at x
        let yCond = (elevA + bottomH);
        if (bottomProf && bottomProf.samples && bottomProf.samples.length) {
          let best = bottomProf.samples[0];
          let bd = Math.abs(best.x - x);
          bottomProf.samples.forEach(s => {
            const d = Math.abs(s.x - x);
            if (d < bd) { bd = d; best = s; }
          });
          yCond = best.yCond;
        } else {
          // Parabolic approx: sag at mid, scale
          const sag = bottomSag65 || 0;
          const xi = Lfore > 0 ? x / Lfore : 0;
          yCond = elevA + bottomH - 4 * sag * xi * (1 - xi);
        }
        const clr = yCond - yStructTop;
        const ok = clr >= structLimit - 1e-6;
        if (!ok) structure_ok = false;
        structureRows.push({
          i: si + 1,
          x, h_top: hTop,
          label: sp.label || sp.name || ('S' + (si + 1)),
          applicable_m: structApplClear != null ? structApplClear : structLimit,
          clearance_m: clr,
          ok
        });
      });
      if (structPts.length === 0) structure_ok = true;

      if (spanPlot) {
        spanPlot.ground_ok = groundOk;
        spanPlot.circuit_ok = allCcOk;
        spanPlot.applicable_clearance_m = applClear;
        spanPlot.cc_pairs = ccPairs;
        spanPlot.structures = structureRows;
        spanPlot.structure_ok = structure_ok;
        spanPlot.structure_applicable_m = structApplClear;
      }

      // --- Common-mode: resolve THIS pole's real config (not the union) ---
      let poleConfigNo = r.config_no || r.config_fore || r.config_aft || (config && config.config_no);
      let poleCfgObj = null;
      if (isCommonMode && state.commonSections && state.commonSections.length) {
        const pNo = num(r.pole_no);
        if (!r.transition) {
          for (let ci = 0; ci < state.commonSections.length; ci++) {
            const cs = state.commonSections[ci];
            const a = num(cs.start_pole), b = num(cs.end_pole);
            const next = state.commonSections[ci + 1];
            const isTransEnd = next && num(next.start_pole) === b && pNo === b;
            const prev = state.commonSections[ci - 1];
            const isTransStart = prev && num(prev.end_pole) === a && pNo === a;
            if (pNo >= a && pNo <= b && !isTransEnd && !isTransStart) {
              poleConfigNo = cs.config_no;
              break;
            }
          }
        } else if (r.config_fore) {
          poleConfigNo = r.config_fore; // PH / display = fore
        }
      }
      try { poleCfgObj = data.configs.find(c => String(c.config_no) === String(poleConfigNo)); } catch (e) {}
      const poleConfigDesc = poleCfgObj
        ? ((poleCfgObj.config_no || '') + ' — ' + (poleCfgObj.description || ''))
        : String(poleConfigNo || '');

      // Presence: stage must exist on this pole's config AND have a non-blank section No
      let stagePresent = new Array(nHH + nH + nL).fill(!isCommonMode);
      let presentHH = !isCommonMode && !!nCondHH;
      let presentH = !isCommonMode && !!nCondH;
      let presentL = !isCommonMode && !!nCondL;
      if (isCommonMode) {
        const cHH = num(poleCfgObj && poleCfgObj.levels_HH, 0) || 0;
        const cH = num(poleCfgObj && poleCfgObj.levels_H, 0) || 0;
        const cL = num(poleCfgObj && poleCfgObj.levels_L, 0) || 0;
        const csUse = r.circuit_sections || {};
        const csA = r.circuit_sections_aft || {};
        const csF = r.circuit_sections_fore || csUse;
        for (let i = 0; i < nHH + nH + nL; i++) {
          const band = i < nHH ? 'HH' : (i < nHH + nH ? 'H' : 'L');
          const localIdx = band === 'HH' ? i : (band === 'H' ? i - nHH : i - nHH - nH);
          let inCfg = false;
          if (band === 'HH') inCfg = localIdx < cHH;
          else if (band === 'H') inCfg = localIdx < cH;
          else inCfg = localIdx < cL;
          const key = band + ':' + (localIdx + 1);
          const hasSec = (csUse[key] !== '' && csUse[key] != null)
            || (csA[key] !== '' && csA[key] != null)
            || (csF[key] !== '' && csF[key] != null);
          stagePresent[i] = !!(inCfg && hasSec);
        }
        presentHH = stagePresent.slice(0, nHH).some(Boolean);
        presentH = stagePresent.slice(nHH, nHH + nH).some(Boolean);
        presentL = stagePresent.slice(nHH + nH).some(Boolean);
      }
      // Mask T65 / sag arrays for absent stages
      const T65_masked = Array.isArray(T65_kN_stages)
        ? T65_kN_stages.map((v, i) => stagePresent[i] ? v : null) : T65_kN_stages;
      const sag27_masked = Array.isArray(sag27)
        ? sag27.map((v, i) => stagePresent[i] ? v : null) : sag27;

      return {
        section: r.section, pole_no: r.pole_no, aft: r.aft, fore: r.fore,
        elev_delta: r.elev_delta, abs_elev: r.abs_elev,
        max_terrain_m: maxTerrainH,
        use_unequal: useUnequal,
        T65_kN_stages: T65_masked,
        span_plot: spanPlot,
        wind_span: windSpan, weight_span: weightSpanEff, angle: r.angle, soil: r.soil,
        weight_span_avg: weightSpan,
        eq_span: sectionEq[r.section] || 0,
        eq_span_ci: (function() {
          if (!isCommonMode || typeof state === 'undefined' || !state.circuitSectionCI) return null;
          const out = {};
          const p = num(r.pole_no);
          Object.keys(state.circuitSectionCI).forEach(id => {
            const ci = state.circuitSectionCI[id] || {};
            const f = Number(ci.from_pole), t = Number(ci.to_pole);
            if (!(p >= f && p <= t)) return;
            if (typeof ciEq !== 'undefined' && ciEq[id] != null) {
              const [bc, secNo] = id.split('|');
              const [band, circ] = (bc || '').split(':');
              const volt = band === 'HH' ? '33kV' : (band === 'H' ? '11kV' : 'LV');
              const lab = volt + ' C' + (circ || '1') + ' S' + (secNo || '') + ' (' + f + '-' + t + ')';
              out[lab] = ciEq[id];
            }
          });
          return Object.keys(out).length ? out : null;
        })(),
        config_no: poleConfigNo,
        config_label: poleConfigDesc,
        stage_present: stagePresent,
        present_HH: presentHH,
        present_H: presentH,
        present_L: presentL,
        tension_HH_kN: (function() {
          if (!presentHH) return 0;
          if (isCommonMode && typeof ciTen !== 'undefined') {
            const cs = r.circuit_sections_fore || r.circuit_sections || {};
            // first HH circuit with section no
            for (let c = 1; c <= Math.max(nHH, 1); c++) {
              const sn = cs['HH:' + c];
              if (sn !== '' && sn != null && ciTen['HH:' + c + '|' + String(sn).trim()] > 0)
                return ciTen['HH:' + c + '|' + String(sn).trim()];
            }
          }
          return tHH;
        })(),
        tension_H_kN: (function() {
          if (!presentH) return 0;
          if (isCommonMode && typeof ciTen !== 'undefined') {
            const cs = r.circuit_sections_fore || r.circuit_sections || {};
            for (let c = 1; c <= Math.max(nH, 1); c++) {
              const sn = cs['H:' + c];
              if (sn !== '' && sn != null && ciTen['H:' + c + '|' + String(sn).trim()] > 0)
                return ciTen['H:' + c + '|' + String(sn).trim()];
            }
          }
          return tH;
        })(),
        tension_L_kN: (function() {
          if (!presentL) return 0;
          if (isCommonMode && typeof ciTen !== 'undefined') {
            const cs = r.circuit_sections_fore || r.circuit_sections || {};
            for (let c = 1; c <= Math.max(nL, 1); c++) {
              const sn = cs['L:' + c];
              if (sn !== '' && sn != null && ciTen['L:' + c + '|' + String(sn).trim()] > 0)
                return ciTen['L:' + c + '|' + String(sn).trim()];
            }
          }
          return tL;
        })(),
        bm_wind_cond_kNm: bmC, bm_tension_kNm: isTerminal ? 0 : bmT,
        bm_long_kNm: bmLongFull,
        bm_long_section_kNm: isTerminal ? 0 : bmT_long_section,
        bm_pole_kNm: bmP, bm_equip_kNm: bmE,
        pole_top_load_daN: poleTopLoad,
        spur_moment_kNm: spurMoment,
        spur_moment_long_kNm: spurMomentLong,
        spur_details: spurDetails,
        crossarms: r.crossarms || { HH: [], H: [] },
        terminal_long_load_daN: longLoadDaN, // Longitudinal (daN) — terminal, intermediate, and section
        guy_theta_deg: (typeof thetaGuy !== 'undefined' ? thetaGuy : 0),
        guy_pole_angle_deg: (typeof guyAnglePole !== 'undefined' ? guyAnglePole : guyAngle),
        guy_long_force_daN: (typeof flGuyDaN !== 'undefined' ? flGuyDaN : 0),
        bm_long_guy_kNm: (typeof bmLongGuy !== 'undefined' ? bmLongGuy : 0),
        excessive_guy_theta: (typeof excessiveGuyTheta !== 'undefined' ? !!excessiveGuyTheta : false),
        conductor_vertical_kN: Vcond_kN,
        load_without_tension_daN: residualLoad,
        guy_load_daN: Math.max(guyLoad || 0, (typeof guyLoadLong !== "undefined" ? guyLoadLong : 0) || 0) || guyLoad,
        unguyed: unguyedLabel,
        guyed: guyed ? guyed.label : '',
        guy_arrangement: guyArrLabel || (guyed ? gCls : ''),
        guy_load_trans_daN: (typeof guyLoadTrans !== 'undefined' ? guyLoadTrans : guyLoad),
        guy_load_long_daN: (typeof guyLoadLong !== 'undefined' ? guyLoadLong : 0),
        guy_arr_trans: (typeof guyArrTrans !== 'undefined' ? guyArrTrans : ''),
        guy_arr_long: (typeof guyArrLong !== 'undefined' ? guyArrLong : ''),
        strutted: struttedLabel,
        pole_top_load_strut_daN: poleTopLoadStrut,
        alternative1,
        alternative2,
        alternatives,
        foundation: fd,
        most_economic: formatPoleLabel(PH, mostEconomic),
        recommended: formatPoleLabel(PH, recommended),
        buckling_raw_kN: V,
        buckling_demand_kN: bucklingDemand,
        buckling_capacity_kN: bucklingKN,
        buckling_ok: bucklingOK,
        guyed_before_buckling: guyedBeforeBuckling,
        recommended_on_buckling: recommendedOnBuckling,
        buckling_compliance: bucklingCompliance,
        is_terminal: isTerminal, is_section: isSectionPole, equipment: r.equipment || '', kva: r.kva,
        tf_area_m2: area || 0,
        tf_weight_kg: tfKg,
        tie,
        // Common mode: only report insulators for circuits present on this pole
        tie_HH: presentHH ? tieHH : '',
        tie_H: presentH ? tieH : '',
        insulator_HH: presentHH ? insHH : '',
        insulator_H: presentH ? insH : '',
        insulator_HH_detail: presentHH ? insHH_detail : '',
        insulator_H_detail: presentH ? insH_detail : '',
        insulator_note: insulator_note || '',
        R_insulator_HH_kN: presentHH ? R_HH : null,
        R_insulator_H_kN: presentH ? R_H : null,
        R_recalc_HH_kN: presentHH ? Rre_HH : null,
        R_recalc_H_kN: presentH ? Rre_H : null,
        xarm_HH: config.post_class_HH || '', xarm_H: config.post_class_H || '',
        missing_conductor_data: '',
        remark: [isTerminal ? 'T' : (isSectionPole ? 'S' : ''), r.equipment ? String(r.equipment) : (r.kva ? 'TF'+r.kva : '')].filter(Boolean).join(' '),
        // Clearance / sag
        span_environment: env,
        sag65_m: (Array.isArray(sag65) && typeof stagePresent !== "undefined" ? sag65.map((v,i) => stagePresent[i] ? v : null) : sag65),
        sag27_m: (typeof sag27_masked !== "undefined" ? sag27_masked : sag27),
        lowest_clearance_m: lowestClearance,
        applicable_clearance_m: applClear,
        ground_clearance_ok: groundOk,
        structure_clearances: structureRows,
        structure_clearance_ok: structure_ok,
        structure_applicable_m: structApplClear,
        cc_pairs: ccPairs,
        circuit_clearance_ok: allCcOk,
        bottom_band: bottomBand,
        stage_volt_labels: stageVoltLabels,
        stage_bands: stageBands
      };
    });

    // --- Conductor horizontal separation check (11/33 kV only) ---
    // D_req = 0.75√s + V²/20000; D_actual = min(min_sep start, min_sep end) for stage crossarms
    const xaRows = (data.crossarm_spacings || []);
    const minSep = (code) => {
      const hit = xaRows.find(x => String(x.config_no) === String(code));
      return hit ? num(hit.minimum_separation_m, null) : null;
    };
    const xaCode = (poleRes, band, stageLocalIdx) => {
      const xa = poleRes.crossarms || {};
      const arr = xa[band] || [];
      if (arr[stageLocalIdx] != null && arr[stageLocalIdx] !== '') return String(arr[stageLocalIdx]);
      // fallback defaults
      return band === 'HH' ? '6' : (band === 'H' ? '10' : '');
    };
    // worst sag temperature label
    const sagTempC = (settings.calc_method === 'clearance_based')
      ? num(settings.cb_t_sag, 65) : 65;
    results.forEach((r, idx) => {
      const next = results[idx + 1];
      // only poles with a fore span toward next pole in same section
      const hasFore = r.fore > 0 && next && String(next.section) === String(r.section);
      const sepChecks = [];
      const nHH = num(config.levels_HH, 0) || 0;
      const nH = num(config.levels_H, 0) || 0;
      // stage index in sag65_m follows height order: HH stages then H then L
      let si = 0;
      for (let i = 0; i < nHH; i++, si++) {
        const sag = (r.sag65_m && r.sag65_m[si] != null) ? Number(r.sag65_m[si]) : null;
        const V = 33;
        const Dreq = (sag != null && hasFore) ? (0.75 * Math.sqrt(Math.max(0, sag)) + (V * V) / 20000) : null;
        const cA = xaCode(r, 'HH', i);
        const cB = hasFore ? xaCode(next, 'HH', i) : cA;
        const dA = minSep(cA), dB = minSep(cB);
        let Dact = null;
        if (dA != null && dB != null) Dact = Math.min(dA, dB);
        else if (dA != null) Dact = dA;
        else if (dB != null) Dact = dB;
        const ok = (Dreq != null && Dact != null) ? (Dact > Dreq) : null;
        sepChecks.push({
          band: 'HH', stage: i + 1, label: 'C' + (si + 1) + ' (33kV)',
          voltage_kV: V, sag_m: sag, D_req_m: Dreq, D_actual_m: Dact,
          crossarm_start: cA, crossarm_end: cB, ok, applicable: hasFore && (r.present_HH !== false)
        });
      }
      for (let i = 0; i < nH; i++, si++) {
        const sag = (r.sag65_m && r.sag65_m[si] != null) ? Number(r.sag65_m[si]) : null;
        const V = 11;
        const Dreq = (sag != null && hasFore) ? (0.75 * Math.sqrt(Math.max(0, sag)) + (V * V) / 20000) : null;
        const cA = xaCode(r, 'H', i);
        const cB = hasFore ? xaCode(next, 'H', i) : cA;
        const dA = minSep(cA), dB = minSep(cB);
        let Dact = null;
        if (dA != null && dB != null) Dact = Math.min(dA, dB);
        else if (dA != null) Dact = dA;
        else if (dB != null) Dact = dB;
        const ok = (Dreq != null && Dact != null) ? (Dact > Dreq) : null;
        sepChecks.push({
          band: 'H', stage: i + 1, label: 'C' + (si + 1) + ' (11kV)',
          voltage_kV: V, sag_m: sag, D_req_m: Dreq, D_actual_m: Dact,
          crossarm_start: cA, crossarm_end: cB, ok, applicable: hasFore && (r.present_H !== false)
        });
      }
      r.separation_checks = sepChecks;
      r.separation_sag_temp_C = sagTempC;
      r.crossarms = r.crossarms || lineRows[idx]?.crossarms || { HH: [], H: [] };
    });

    return {
      poleHeight, config, results,
      sections: [...new Set(lineRows.map(r => r.section))],
      sectionEq, sectionTen,
      stageVoltLabels, stageBands, nStages, bottomBand,
      tensionChecks,
      separation_sag_temp_C: (settings.calc_method === 'clearance_based') ? num(settings.cb_t_sag, 65) : 65
    };
  }

  return { computeLine, num, isMissing, equivalentSpan, lookupTensionKN, lookupSagM, conductorSagM, scaleSag, maxSpanInTable, identifyCircuits };
})();;
