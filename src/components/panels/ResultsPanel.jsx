import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CSV } from '../../engine/csv.js';
import { generateLineRouteSvg, buildSpanPlotSvg } from '../../engine/sketch.js';
import {
  Printer,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Map,
  ClipboardList,
  Layers,
  Shield,
  Activity,
  FileCheck,
  Search,
  Zap,
  Ruler,
  Compass
} from 'lucide-react';

export const ResultsPanel = () => {
  const {
    results,
    projectInfo,
    settings,
    theme,
    commonSections,
    lineStructureMode,
    runCalculation,
    getParsedData,
    setActiveTab
  } = useApp();

  const [activeCategory, setActiveCategory] = useState('summary');
  const [tableSearch, setTableSearch] = useState('');

  if (!results || !results.results || results.results.length === 0) {
    return (
      <div className="tab-panel">
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px', maxWidth: '600px', margin: '40px auto' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Activity size={26} />
          </div>
          <h2 style={{ justifyContent: 'center', fontSize: '18px', margin: '0 0 8px' }}>No Calculation Results Available</h2>
          <p className="hint" style={{ margin: '0 auto 20px' }}>
            Enter your line geometry and conductors, then run the mechanical calculation to view structural selections, clearance checks, and foundation designs.
          </p>
          <button className="primary" onClick={runCalculation} style={{ padding: '10px 24px' }}>
            Run Calculation Now
          </button>
        </div>
      </div>
    );
  }

  const { results: poleRows, config, tensionChecks, sectionEq, sectionTen } = results;
  const data = getParsedData();

  // Route & Mechanical KPI Metrics
  let totalLength = 0;
  let maxPTrans = 0;
  let maxPPole = poleRows[0]?.pole_no;
  let minClearanceVal = Infinity;
  let minClearancePole = poleRows[0]?.pole_no;
  let allPass = true;

  poleRows.forEach(r => {
    totalLength += (r.fore || 0);
    if ((r.pole_top_load_daN || 0) > maxPTrans) {
      maxPTrans = r.pole_top_load_daN;
      maxPPole = r.pole_no;
    }
    if (r.lowest_clearance_m && r.lowest_clearance_m < minClearanceVal) {
      minClearanceVal = r.lowest_clearance_m;
      minClearancePole = r.pole_no;
    }
    if (!r.ground_clearance_ok || r.recommended === 'X') {
      allPass = false;
    }
  });

  // Filtered rows for active search
  const filteredPoles = tableSearch.trim() === ''
    ? poleRows
    : poleRows.filter(r =>
        String(r.pole_no).includes(tableSearch) ||
        String(r.section).includes(tableSearch) ||
        String(r.recommended).toLowerCase().includes(tableSearch.toLowerCase()) ||
        String(r.foundation?.foundation_recommendation).toLowerCase().includes(tableSearch.toLowerCase())
      );

  // Export Results CSV
  const handleExportResultsCsv = () => {
    const exportData = poleRows.map(r => ({
      section: r.section,
      pole_no: r.pole_no,
      fore_span_m: r.fore,
      elev_delta_m: r.elev_delta,
      angle_deg: r.angle,
      soil_class: r.soil,
      pole_top_load_daN: r.pole_top_load_daN?.toFixed(1) || '',
      bm_wind_cond_kNm: r.bm_wind_cond_kNm?.toFixed(2) || '',
      bm_tension_kNm: r.bm_tension_kNm?.toFixed(2) || '',
      bm_pole_kNm: r.bm_pole_kNm?.toFixed(2) || '',
      bm_equip_kNm: r.bm_equip_kNm?.toFixed(2) || '',
      recommended_pole: r.recommended || '',
      guy_load_daN: r.guy_load_daN ? r.guy_load_daN.toFixed(0) : '0',
      guy_arrangement: r.guy_arr_label || '',
      buckling_ok: r.buckling_ok ? 'Pass' : 'Fail',
      insulator_33kV: r.insulator_HH || '',
      tie_33kV: r.tie_HH || '',
      insulator_11kV: r.insulator_H || '',
      tie_11kV: r.tie_H || '',
      foundation_recommendation: r.foundation?.foundation_recommendation || '',
      foundation_type: r.foundation?.foundation_type || '',
      ground_clearance_lowest_m: r.lowest_clearance_m?.toFixed(2) || '',
      ground_clearance_ok: r.ground_clearance_ok ? 'Pass' : 'Fail'
    }));

    const csvStr = CSV.objectsToCsv(exportData);
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pole-selection-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineSketchSvg = generateLineRouteSvg(results, {
    theme,
    settings,
    commonSections,
    lineStructureMode,
    conductorsList: data.conductors || [],
    configsList: data.configs || []
  });

  return (
    <div className="tab-panel" id="panel-results">
      {/* 1. EXECUTIVE KPI SUMMARY METRICS */}
      <div className="kpi-grid no-print">
        <div className="kpi-card">
          <div className="kpi-icon amber">
            <Ruler size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{totalLength.toFixed(0)} m</span>
            <span className="kpi-label">Total Route Length ({poleRows.length} Poles)</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon danger">
            <Compass size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{maxPTrans.toFixed(0)} daN</span>
            <span className="kpi-label">Peak Pole-Top Load (Pole {maxPPole})</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon info">
            <Zap size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{minClearanceVal !== Infinity ? `${minClearanceVal.toFixed(2)} m` : '—'}</span>
            <span className="kpi-label">Min Ground Clearance (Pole {minClearancePole})</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className={`kpi-icon ${allPass ? 'ok' : 'danger'}`}>
            {allPass ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div className="kpi-content">
            <span className="kpi-value" style={{ color: allPass ? 'var(--ok)' : 'var(--danger)', fontSize: '16px' }}>
              {allPass ? 'ALL CHECKS PASS' : 'VERIFICATION NEEDED'}
            </span>
            <span className="kpi-label">Regulatory &amp; Mechanical Status</span>
          </div>
        </div>
      </div>

      <div className="card" id="print-area">
        {/* Header and Toolbar */}
        <div className="card-header-row">
          <div>
            <h2>Engineering Calculations &amp; Design Deliverables</h2>
            <div style={{ fontSize: '12px', color: 'var(--ink-dim)', marginTop: '2px' }}>
              Project: <b>{projectInfo.project || 'Colombo South'}</b> &bull; Line: <b>{projectInfo.lineName || 'Overhead Line Route'}</b> &bull; Config: <b>{config?.description}</b>
            </div>
          </div>

          <div className="btn-row no-print" style={{ margin: 0 }}>
            <button onClick={runCalculation}>
              <RotateCcw size={13} /> Re-Calculate
            </button>
            <button onClick={handleExportResultsCsv}>
              <Download size={13} /> Export CSV
            </button>
            <button className="primary" onClick={() => window.print()}>
              <Printer size={13} /> Print Report (A4)
            </button>
          </div>
        </div>

        {/* Results Category Navigation Bar */}
        <div className="no-print" style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--line)',
          scrollbarWidth: 'thin'
        }}>
          {[
            { id: 'summary', label: 'Executive Summary', icon: ClipboardList },
            { id: 'schematic', label: 'Route Alignment Sketch', icon: Map },
            { id: 'poles', label: 'Detailed Pole Mechanics', icon: Layers },
            { id: 'clearance', label: 'Clearance & Sags', icon: Zap },
            { id: 'foundations', label: 'Foundation Design', icon: Shield },
            { id: 'conductors', label: 'Conductors & Stringing', icon: Activity },
            { id: 'report', label: 'Full Compiled Report', icon: FileCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                className={`sm ${isActive ? 'primary' : ''}`}
                onClick={() => setActiveCategory(tab.id)}
                style={{ borderRadius: '20px', whiteSpace: 'nowrap' }}
              >
                <Icon size={13} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter bar for tabular views */}
        {(activeCategory === 'summary' || activeCategory === 'poles' || activeCategory === 'foundations') && (
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', maxWidth: '340px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ink-muted)' }} />
              <input
                type="text"
                placeholder="Search pole #, recommendation..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '12px', padding: '6px 10px 6px 32px' }}
              />
            </div>
          </div>
        )}

        {/* VIEW 1: EXECUTIVE SUMMARY TABLE */}
        {(activeCategory === 'summary' || activeCategory === 'report') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--amber)', fontFamily: 'var(--mono)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Executive Summary &mdash; Pole by Pole Schedule
            </h3>
            <div className="table-wrap results-scroll">
              <table className="results-full">
                <thead>
                  <tr>
                    <th>Sec</th>
                    <th>Pole #</th>
                    <th>Spans (m)</th>
                    <th>Angle</th>
                    <th>Transverse Load</th>
                    <th>Recommended Pole</th>
                    <th>Insulator &amp; Fittings</th>
                    <th>Foundation Schedule</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoles.map((r, i) => {
                    const insDesc = [
                      r.insulator_HH ? `33kV: ${r.insulator_HH} ${r.tie_HH ? `(${r.tie_HH})` : ''}` : null,
                      r.insulator_H ? `11kV: ${r.insulator_H} ${r.tie_H ? `(${r.tie_H})` : ''}` : null
                    ].filter(Boolean).join(' | ') || '—';

                    const isOk = r.recommended && r.recommended !== 'X' && !r.recommended.includes('excessive');

                    return (
                      <tr key={i}>
                        <td>{r.section}</td>
                        <td><strong style={{ color: 'var(--amber)' }}>P{r.pole_no}</strong></td>
                        <td>{r.aft ? `${r.aft} / ${r.fore}` : `0 / ${r.fore}`}</td>
                        <td>{r.angle > 0 ? <b>{r.angle}&deg;</b> : '0&deg;'}</td>
                        <td><b>{r.pole_top_load_daN?.toFixed(0)} daN</b></td>
                        <td>
                          <span className={`tag ${isOk ? (r.is_terminal ? 'T' : (r.angle > 0 ? 'S' : 'ok')) : 'X'}`}>
                            {r.recommended || 'X'}
                          </span>
                        </td>
                        <td>{insDesc}</td>
                        <td><b>{r.foundation?.foundation_recommendation || '—'}</b></td>
                        <td>
                          {isOk && r.ground_clearance_ok ? (
                            <span className="tag ok">PASS</span>
                          ) : (
                            <span className="tag X">CHECK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: ROUTE ALIGNMENT SCHEMATIC SKETCH */}
        {(activeCategory === 'schematic' || activeCategory === 'report') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--amber)', fontFamily: 'var(--mono)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Line Route Alignment &amp; Structural Schematic Diagram
            </h3>
            <p className="hint">
              Visual route layout depicting pole elevations, span lengths, deviation angles, stay wires, and foundations.
            </p>
            <div
              dangerouslySetInnerHTML={{ __html: lineSketchSvg }}
              style={{ width: '100%', overflowX: 'auto', borderRadius: 'var(--radius-md)' }}
            />
          </div>
        )}

        {/* VIEW 3: DETAILED POLE MECHANICS */}
        {(activeCategory === 'poles' || activeCategory === 'report') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--amber)', fontFamily: 'var(--mono)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              3. Detailed Bending Moments &amp; Pole Class Selections
            </h3>
            <p className="hint">
              Bending moments about ground line (kN&bull;m): BMC (conductor wind), BMT (angle tension), BMp (pole wind), BME (equipment).
            </p>
            <div className="table-wrap results-scroll">
              <table className="results-full">
                <thead>
                  <tr>
                    <th>Sec</th>
                    <th>Pole #</th>
                    <th>Fore</th>
                    <th>Angle</th>
                    <th>BMC</th>
                    <th>BMT</th>
                    <th>BMp</th>
                    <th>BME</th>
                    <th>P Trans</th>
                    <th>P Long</th>
                    <th>Guy Load</th>
                    <th>Guy Arr.</th>
                    <th>Buckling</th>
                    <th>Recommended Pole</th>
                    <th>Alternative Viable</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoles.map((r, i) => (
                    <tr key={i}>
                      <td>{r.section}</td>
                      <td><b>P{r.pole_no}</b></td>
                      <td>{r.fore}m</td>
                      <td>{r.angle}&deg;</td>
                      <td>{r.bm_wind_cond_kNm?.toFixed(2)}</td>
                      <td>{r.bm_tension_kNm?.toFixed(2)}</td>
                      <td>{r.bm_pole_kNm?.toFixed(2)}</td>
                      <td>{r.bm_equip_kNm?.toFixed(2)}</td>
                      <td><b>{r.pole_top_load_daN?.toFixed(1)}</b></td>
                      <td>{r.terminal_long_load_daN?.toFixed(1) || '0.0'}</td>
                      <td>{r.guy_load_daN ? `${r.guy_load_daN.toFixed(0)} daN` : '0'}</td>
                      <td>{r.guy_arr_label || '—'}</td>
                      <td>
                        <span className={`tag ${r.buckling_ok ? 'ok' : 'warn'}`}>
                          {r.buckling_compliance || (r.buckling_ok ? 'Pass' : 'Fail')}
                        </span>
                      </td>
                      <td>
                        <span className="tag ok" style={{ fontWeight: 800 }}>
                          {r.recommended}
                        </span>
                      </td>
                      <td style={{ color: 'var(--ink-dim)' }}>
                        {r.alternative1 || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: CLEARANCES & SAG PROFILES */}
        {(activeCategory === 'clearance' || activeCategory === 'report') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--amber)', fontFamily: 'var(--mono)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              4. Ground Clearance &amp; Catenary Profiles (@ 65&deg;C Max Sag)
            </h3>
            <p className="hint">
              Clearance verification comparing catenary profiles with regulatory statutory limits.
            </p>
            <div className="table-wrap results-scroll" style={{ marginBottom: '16px' }}>
              <table className="results-full">
                <thead>
                  <tr>
                    <th>Sec</th>
                    <th>Span</th>
                    <th>Fore Span</th>
                    <th>Elev &Delta;</th>
                    <th>Max Sag @ 65&deg;C</th>
                    <th>Lowest Clearance</th>
                    <th>Regulatory Required</th>
                    <th>Ground Status</th>
                    <th>Circuit-to-Circuit</th>
                  </tr>
                </thead>
                <tbody>
                  {poleRows.filter(r => r.fore > 0).map((r, i) => {
                    const nextP = poleRows[i + 1]?.pole_no || (r.pole_no + 1);
                    const s65 = r.sag65_m?.[r.sag65_m.length - 1];
                    return (
                      <tr key={i}>
                        <td>{r.section}</td>
                        <td><b>P{r.pole_no} &rarr; P{nextP}</b></td>
                        <td>{r.fore} m</td>
                        <td>{r.elev_delta} m</td>
                        <td>{s65 ? `${s65.toFixed(2)} m` : '—'}</td>
                        <td><b>{r.lowest_clearance_m ? `${r.lowest_clearance_m.toFixed(2)} m` : '—'}</b></td>
                        <td>{r.applicable_clearance_m ? `${r.applicable_clearance_m.toFixed(2)} m` : '5.50 m'}</td>
                        <td>
                          <span className={`tag ${r.ground_clearance_ok ? 'ok' : 'X'}`}>
                            {r.ground_clearance_ok ? 'PASS' : 'UNSATISFIED'}
                          </span>
                        </td>
                        <td><span className="tag ok">SATISFIED</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Span Catenary Sketches */}
            {poleRows.some(r => r.span_plot) && (
              <div>
                <h4 style={{ fontSize: '12.5px', color: 'var(--amber)', fontFamily: 'var(--mono)', margin: '14px 0 8px' }}>
                  Span Elevation &amp; Clearance Cross-Sections
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '14px' }}>
                  {poleRows.map((r, i) => {
                    if (!r.span_plot) return null;
                    const plotSvg = buildSpanPlotSvg(r.span_plot);
                    return (
                      <div key={i} style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                        <div style={{ fontSize: '11.5px', color: 'var(--amber)', fontWeight: 'bold', marginBottom: '6px' }}>
                          Span P{r.pole_no} &rarr; P{r.pole_no + 1} ({r.fore}m &bull; Min Clearance: {r.lowest_clearance_m?.toFixed(2)}m)
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: plotSvg }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: FOUNDATIONS & SOILS */}
        {(activeCategory === 'foundations' || activeCategory === 'report') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--amber)', fontFamily: 'var(--mono)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              5. Pole Foundation Overturning Stability &amp; Bearing Pads
            </h3>
            <p className="hint">
              Embedment depth L = PH/6, fulcrum f = L/&radic;2. Moment of soil resistance M<sub>R</sub> evaluated for working rotation &theta; = 0.01 rad.
            </p>
            <div className="table-wrap results-scroll">
              <table className="results-full">
                <thead>
                  <tr>
                    <th>Sec</th>
                    <th>Pole #</th>
                    <th>Soil Class</th>
                    <th>BMF (kN&bull;m)</th>
                    <th>M<sub>R</sub> Soil (kN&bull;m)</th>
                    <th>Overturning Stability</th>
                    <th>Total Vertical Load</th>
                    <th>Pad Type A</th>
                    <th>Pad Type B</th>
                    <th>Pad Type C</th>
                    <th>Recommended Pad</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoles.map((r, i) => {
                    const fd = r.foundation || {};
                    return (
                      <tr key={i}>
                        <td>{r.section}</td>
                        <td><b>P{r.pole_no}</b></td>
                        <td>Class {fd.soil_class}</td>
                        <td>{fd.bmf_kNm?.toFixed(2)}</td>
                        <td>{fd.mg_kNm?.toFixed(2)}</td>
                        <td>
                          <span className={`tag ${fd.stable ? 'ok' : 'X'}`}>
                            {fd.stable ? 'Stable' : 'Unstable'}
                          </span>
                        </td>
                        <td>{fd.total_vertical_kN?.toFixed(2)} kN</td>
                        <td>{fd.bearing_A_kN?.toFixed(1)} kN</td>
                        <td>{fd.bearing_B_kN?.toFixed(1)} kN</td>
                        <td>{fd.bearing_C_kN?.toFixed(1)} kN</td>
                        <td>
                          <span className="tag ok">
                            {fd.foundation_recommendation || 'Type B'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 6: CONDUCTORS & STRINGING */}
        {(activeCategory === 'conductors' || activeCategory === 'report') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--amber)', fontFamily: 'var(--mono)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              6. Conductor Everyday Tension &amp; Field Stringing Chart (@ 27&deg;C)
            </h3>
            <p className="hint">
              Stringing sags scaled to individual fore spans using equivalent ruling spans without wind.
            </p>
            <div className="table-wrap results-scroll">
              <table className="results-full">
                <thead>
                  <tr>
                    <th>Sec</th>
                    <th>Pole #</th>
                    <th>Fore Span</th>
                    <th>Ruling Eq. Span</th>
                    <th>Stage Conductor</th>
                    <th>Everyday Sag @ 27&deg;C</th>
                    <th>Tension Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {poleRows.filter(r => r.fore > 0).map((r, i) => {
                    const s27 = r.sag27_m?.[0];
                    return (
                      <tr key={i}>
                        <td>{r.section}</td>
                        <td><b>P{r.pole_no}</b></td>
                        <td>{r.fore} m</td>
                        <td>{r.eq_span?.toFixed(1)} m</td>
                        <td>Racoon 11 kV / Weasel LV</td>
                        <td><strong style={{ color: 'var(--amber)' }}>{s27 ? `${s27.toFixed(3)} m` : '—'}</strong></td>
                        <td>100% Tension</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. FORMAL ENGINEERING APPROVAL BOX (PRINT VIEW) */}
        <div id="print-approval" style={{ marginTop: '36px', pageBreakInside: 'avoid' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', fontFamily: 'var(--sans)' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #333', padding: '8px', width: '33%', textAlign: 'left', background: 'var(--panel-2)' }}>Prepared by:</th>
                <th style={{ border: '1px solid #333', padding: '8px', width: '33%', textAlign: 'left', background: 'var(--panel-2)' }}>Recommended by:</th>
                <th style={{ border: '1px solid #333', padding: '8px', width: '33%', textAlign: 'left', background: 'var(--panel-2)' }}>Approved by:</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #333', padding: '36px 8px', height: '56px' }}></td>
                <td style={{ border: '1px solid #333', padding: '36px 8px' }}></td>
                <td style={{ border: '1px solid #333', padding: '36px 8px' }}></td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '6px 8px' }}>Electrical Engineer (Projects)</td>
                <td style={{ border: '1px solid #333', padding: '6px 8px' }}>Senior Project Engineer</td>
                <td style={{ border: '1px solid #333', padding: '6px 8px' }}>Chief Engineer / General Manager</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '6px 8px' }}>Date:</td>
                <td style={{ border: '1px solid #333', padding: '6px 8px' }}>Date:</td>
                <td style={{ border: '1px solid #333', padding: '6px 8px' }}>Date:</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
