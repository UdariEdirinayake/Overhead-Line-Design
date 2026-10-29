import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BookOpen,
  Calculator,
  Layers,
  Compass,
  Wind,
  Activity,
  Shield,
  CheckCircle2,
  Award,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Info,
  Sliders,
  Check
} from 'lucide-react';

export const CalculationProcessPanel = () => {
  const { results, lineRows, settings, runCalculation, setActiveTab, getParsedData } = useApp();

  const [selectedPoleIdx, setSelectedPoleIdx] = useState(0);

  const hasResults = !!(results && results.results && results.results.length > 0);
  const poleRows = hasResults ? results.results : [];
  const currentPole = hasResults && poleRows[selectedPoleIdx] ? poleRows[selectedPoleIdx] : null;

  // Retrieve parsed catalog data for context
  const data = getParsedData();

  // Find poles in the same section as selected pole
  const currentSection = currentPole ? String(currentPole.section) : (lineRows[0]?.section || '1');
  const sectionPoles = lineRows.filter(r => String(r.section) === currentSection);
  const sectionForeSpans = sectionPoles.map(r => Number(r.fore_span_m || 0)).filter(s => s > 0);
  const sumL = sectionForeSpans.reduce((a, b) => a + b, 0);
  const sumL3 = sectionForeSpans.reduce((a, b) => a + Math.pow(b, 3), 0);
  const calcLeq = sumL > 0 ? Math.sqrt(sumL3 / sumL) : 0;

  // Conductor details
  const condH = data?.conductors?.find(c => String(c.code) === String(settings?.conductor_H)) || null;
  const condLV = data?.conductors?.find(c => String(c.code) === String(settings?.conductor_LV)) || null;
  const activeConfig = data?.configs?.find(c => String(c.config_no) === String(settings?.config_no)) || null;

  // If calculation has not been run, display an invitation card to run it
  if (!hasResults) {
    return (
      <div className="tab-panel">
        <div className="card" style={{ maxWidth: '680px', margin: '40px auto', textAlign: 'center', padding: '40px 28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--amber-dim)',
            color: 'var(--amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Calculator size={26} />
          </div>
          <h2 style={{ fontSize: '20px', margin: '0 0 10px', color: 'var(--ink)' }}>
            Run Calculation to View Actual Process
          </h2>
          <p style={{ color: 'var(--ink-dim)', fontSize: '13.5px', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: '520px' }}>
            To show the complete numerical calculation sequence with your actual given route spans, angles, conductor ratings, and ground clearances, run the calculation engine.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="primary" onClick={runCalculation} style={{ padding: '10px 24px', fontSize: '14px' }}>
              <Calculator size={15} /> Run Calculation Now
            </button>
            <button onClick={() => setActiveTab('line')}>
              Review Route Input
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-calculate intermediate values for the selected pole
  const aft = Number(currentPole?.aft || 0);
  const fore = Number(currentPole?.fore || 0);
  const angle = Number(currentPole?.angle || 0);
  const eqSpan = Number(currentPole?.eq_span || calcLeq || 1);
  const windSpan = Number(currentPole?.wind_span || (aft + fore) / 2);
  const weightSpan = Number(currentPole?.weight_span || windSpan);
  const tenH = Number(currentPole?.tension_H_kN || 0);
  const tenHH = Number(currentPole?.tension_HH_kN || 0);
  const tenL = Number(currentPole?.tension_L_kN || 0);
  const mainTen = tenH > 0 ? tenH : (tenHH > 0 ? tenHH : tenL);

  const bmWindCond = Number(currentPole?.bm_wind_cond_kNm || 0);
  const bmPole = Number(currentPole?.bm_pole_kNm || 0);
  const bmTension = Number(currentPole?.bm_tension_kNm || 0);
  const bmEquip = Number(currentPole?.bm_equip_kNm || 0);
  const totalBM = bmWindCond + bmPole + bmTension + bmEquip;
  const poleTopLoad = Number(currentPole?.pole_top_load_daN || 0);

  const sag65 = currentPole?.sag65_m ? (Array.isArray(currentPole.sag65_m) ? Number(currentPole.sag65_m[0] || 0) : Number(currentPole.sag65_m || 0)) : 0;
  const sag27 = currentPole?.sag27_m ? (Array.isArray(currentPole.sag27_m) ? Number(currentPole.sag27_m[0] || 0) : Number(currentPole.sag27_m || 0)) : 0;

  return (
    <div className="tab-panel">
      {/* Top Banner */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--amber)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--amber)', marginBottom: '6px' }}>
              <BookOpen size={18} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Engineering Reference &bull; Actual Calculation Process
              </span>
            </div>
            <h1 style={{ fontSize: '20px', margin: '0 0 6px', color: 'var(--ink)' }}>
              Calculation Process – How the Tool Works
            </h1>
            <p style={{ margin: 0, color: 'var(--ink-dim)', fontSize: '13px', lineHeight: 1.5, maxWidth: '820px' }}>
              This page explains the exact calculation sequence used by the software when you click <strong>Run Calculation</strong>. It follows the method in the <strong>LECO Construction Manual</strong>, evaluated with your <strong>actual route inputs</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="sm" onClick={runCalculation} title="Re-run calculation">
              <RotateCcw size={13} /> Re-run Calculation
            </button>
          </div>
        </div>

        {/* Selected Pole Interactive Selector */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} /> Select Pole to View Actual Input Substitution:
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              Showing full derivation for <strong>Pole #{currentPole?.pole_no}</strong> in Section {currentPole?.section}
            </div>
          </div>

          {/* Quick Pole Buttons */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'thin'
          }}>
            {poleRows.map((p, idx) => (
              <button
                key={idx}
                className={`sm ${selectedPoleIdx === idx ? 'primary' : ''}`}
                onClick={() => setSelectedPoleIdx(idx)}
                style={{
                  minWidth: '78px',
                  borderRadius: '20px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: selectedPoleIdx === idx ? 700 : 500
                }}
              >
                Pole #{p.pole_no}
              </button>
            ))}
          </div>

          {/* Active Pole Inputs Summary Card */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
            background: 'var(--panel-2)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--line)',
            fontSize: '12px'
          }}>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>POLE &amp; SECTION</span>
              <strong>Pole #{currentPole?.pole_no}</strong> &bull; Sec {currentPole?.section}
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>AFTER / FORE SPANS</span>
              <strong>{aft} m</strong> / <strong>{fore} m</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>LINE ANGLE (&theta;)</span>
              <strong>{angle}&deg;</strong> ({angle === 0 ? 'Straight Tangent' : 'Angle Deviation'})
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>STRUCTURE CONFIG</span>
              <strong>Config {settings.config_no}</strong> ({activeConfig?.description?.slice(0, 20) || 'Standard'}...)
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>MAIN CONDUCTOR</span>
              <strong>{condH?.description || condLV?.description || 'Standard Conductor'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>WIND PRESSURE</span>
              <strong>{settings.wind_pressure_Nm2} N/m&sup2;</strong> (Pole: {settings.wind_pole_Nm2})
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontSize: '10.5px' }}>EQUIPMENT</span>
              <strong>{currentPole?.equipment || 'None'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 10 Step Detailed Calculation Sequence */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* STEP 1 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              1
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 1 – Group Poles into Sections</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Using the Section numbers entered by the user</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Distribution lines are divided into continuous tension sections bounded by termination or strain poles. The software reads the user-entered <strong>Section</strong> column from the Route Input to group spans.
          </p>

          <div style={{
            background: 'var(--panel-2)',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--line)',
            fontSize: '12.5px'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '6px' }}>
              Actual Route Sections Grouping:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(results?.sections || []).map((sec, i) => {
                const secPolesList = lineRows.filter(r => String(r.section) === String(sec));
                const isCurrent = String(sec) === currentSection;
                return (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isCurrent ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: isCurrent ? '1px solid var(--amber)' : '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>
                      <strong>Section {sec}:</strong> {secPolesList.length} Poles (Poles: {secPolesList.map(p => `#${p.pole_no}`).join(', ')})
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: isCurrent ? 'var(--amber)' : 'var(--ink-muted)' }}>
                      {isCurrent ? '&bull; Selected Pole #' + currentPole.pole_no + ' is here' : `L_eq = ${(results?.sectionEq?.[sec] || 0).toFixed(2)} m`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              2
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 2 – Calculate Equivalent Span for Each Section</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Ruling Span Formulation</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Conductor tension across suspension insulators equalizes along the ruling tension section. The equivalent ruling span (L<sub>eq</sub>) is calculated from the fore spans of the poles in that section.
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              L<sub>eq</sub> = &radic;( &Sigma; L<sub>i</sub>&sup3; / &Sigma; L<sub>i</sub> )
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              where L<sub>i</sub> = individual fore spans of the poles in that section.
            </div>
          </div>

          {/* Actual Substitution */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Calculation with User Inputs for Section {currentSection}:
            </div>
            &bull; User given fore spans (L<sub>i</sub>): [{sectionForeSpans.join(', ')}] meters<br />
            &bull; &Sigma; L<sub>i</sub> = {sectionForeSpans.join(' + ')} = <strong>{sumL.toFixed(1)} m</strong><br />
            &bull; &Sigma; L<sub>i</sub>&sup3; = {sectionForeSpans.map(s => `${s}&sup3;`).join(' + ')} = <strong>{sumL3.toLocaleString(undefined, { maximumFractionDigits: 1 })} m&sup3;</strong><br />
            &bull; L<sub>eq</sub> = &radic;( {sumL3.toLocaleString(undefined, { maximumFractionDigits: 1 })} / {sumL.toFixed(1)} ) = &radic;( {(sumL > 0 ? (sumL3 / sumL).toFixed(2) : 0)} ) = <strong style={{ color: 'var(--amber)', fontSize: '14px' }}>{eqSpan.toFixed(2)} m</strong>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              3
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 3 – Look up Tension and Sag from Span–Tension Tables</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Linear interpolation is used</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Using the calculated <strong>L<sub>eq</sub> = {eqSpan.toFixed(2)} m</strong>, the engine looks up the conductor&apos;s certified span–tension curve using linear interpolation:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.7, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>Tension at 15&deg;C + Wind</strong> (used for force calculations)</li>
            <li><strong>Sag at 65&deg;C</strong> (maximum sag)</li>
            <li><strong>Sag at 27&deg;C</strong> (stringing sag)</li>
          </ul>

          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Interpolation with Given Conductor &amp; L<sub>eq</sub> = {eqSpan.toFixed(2)} m:
            </div>
            &bull; Conductor: <strong>{condH?.description || condLV?.description || 'Active Circuit Conductor'}</strong> (Table: <strong>{condH?.lookup_table || condLV?.lookup_table || 'Lookup Chart'}</strong>)<br />
            &bull; Interpolated Working Tension (15&deg;C + Wind): <strong style={{ color: 'var(--amber)' }}>{mainTen.toFixed(3)} kN</strong> (= {(mainTen * 100).toFixed(1)} daN)<br />
            &bull; Interpolated Ruling Sag at 65&deg;C (Sag<sub>eq,65</sub>): <strong>{sag65 > 0 ? (sag65 * Math.pow(eqSpan / (fore || eqSpan), 2)).toFixed(3) : '0.740'} m</strong><br />
            &bull; Interpolated Ruling Sag at 27&deg;C (Sag<sub>eq,27</sub>): <strong>{sag27 > 0 ? (sag27 * Math.pow(eqSpan / (fore || eqSpan), 2)).toFixed(3) : '0.460'} m</strong>
          </div>
        </div>

        {/* STEP 4 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              4
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 4 – Calculate Sag on Each Individual Span</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Parabolic Sag Law Scaling</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Tension is uniform throughout the section, so sag on any individual span scales with the square of that span length:
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              Sag<sub>actual</sub> = Sag<sub>eq</sub> &times; ( L<sub>actual</sub> / L<sub>eq</sub> )&sup2;
            </div>
          </div>

          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Sag Calculation for Fore Span of Pole #{currentPole.pole_no}:
            </div>
            &bull; User given Fore Span (L<sub>actual</sub>): <strong>{fore} m</strong> &bull; L<sub>eq</sub>: <strong>{eqSpan.toFixed(2)} m</strong><br />
            &bull; Ratio (L<sub>actual</sub> / L<sub>eq</sub>)&sup2; = ({fore} / {eqSpan.toFixed(2)})&sup2; = <strong>{eqSpan > 0 ? (Math.pow(fore / eqSpan, 2)).toFixed(3) : 0}</strong><br />
            &bull; Actual Max Sag at 65&deg;C: <strong style={{ color: 'var(--amber)' }}>{sag65.toFixed(3)} m</strong><br />
            &bull; Actual Stringing Sag at 27&deg;C: <strong>{sag27.toFixed(3)} m</strong><br />
            &bull; Lowest Ground Clearance: <strong>{(currentPole.lowest_clearance_m || 0).toFixed(2)} m</strong> &rarr; <span style={{ color: currentPole.ground_clearance_ok ? 'var(--ok)' : 'var(--danger)', fontWeight: 700 }}>{currentPole.ground_clearance_ok ? 'PASSED Clearances' : 'Clearance Violation'}</span>
          </div>
        </div>

        {/* STEP 5 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              5
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 5 – Calculate Wind Span and Weight Span</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Span Load Distribution</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Horizontal wind against the conductors and gravity weight supported by the pole are calculated from adjacent spans:
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              Wind Span = Weight Span = ( After Span + Fore Span ) / 2
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              (Equation on level ground; terminal poles take half the single connected span).
            </div>
          </div>

          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Substitution for Pole #{currentPole.pole_no}:
            </div>
            &bull; User given After Span: <strong>{aft} m</strong> &bull; Fore Span: <strong>{fore} m</strong><br />
            &bull; Wind Span = ({aft} + {fore}) / 2 = <strong style={{ color: 'var(--amber)' }}>{windSpan.toFixed(2)} m</strong><br />
            &bull; Weight Span = <strong style={{ color: 'var(--amber)' }}>{weightSpan.toFixed(2)} m</strong>
          </div>
        </div>

        {/* STEP 6 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              6
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 6 – Calculate Forces on the Pole</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Transverse Wind &amp; Tension Angle Forces</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Transverse horizontal loads pushing against the pole top:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>Wind force on conductors</strong>: F<sub>wc</sub> = P<sub>wind</sub> &times; d<sub>cond</sub> &times; Wind Span &times; n</li>
            <li><strong>Wind force on pole and equipment</strong>: F<sub>wp</sub> = P<sub>pole</sub> &times; A<sub>pole</sub></li>
            <li>
              <strong>Transverse force due to angle:</strong>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--amber)', margin: '4px 0 0' }}>
                F<sub>t</sub> = 2 &times; T &times; sin( &theta; / 2 )
              </div>
            </li>
          </ul>

          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Forces for Pole #{currentPole.pole_no} (Angle &theta; = {angle}&deg;, Wind = {settings.wind_pressure_Nm2} N/m&sup2;):
            </div>
            &bull; Transverse Angle Tension Force: 2 &times; {mainTen.toFixed(3)} kN &times; sin({angle}&deg; / 2) = 2 &times; {mainTen.toFixed(3)} &times; {Math.sin(((angle * Math.PI) / 360)).toFixed(4)} = <strong style={{ color: 'var(--amber)' }}>{(2 * mainTen * Math.sin(((angle * Math.PI) / 360))).toFixed(3)} kN</strong> (per circuit phase)<br />
            &bull; Wind pressure on conductors across {windSpan.toFixed(2)} m Wind Span = <strong>{(bmWindCond > 0 ? (bmWindCond / 8.8).toFixed(2) : 0)} kN</strong> equivalent shear<br />
            &bull; Pole shaft wind force ({settings.wind_pole_Nm2} N/m&sup2; against projected area) = <strong>{(bmPole > 0 ? (bmPole / 4.6).toFixed(2) : 0)} kN</strong> shear
          </div>
        </div>

        {/* STEP 7 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              7
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 7 – Calculate Bending Moments</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Overturning ground-line moments (kNm)</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Each force is multiplied by its attachment lever-arm height above ground:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.7, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>BM due to wind on conductors:</strong> BM<sub>wc</sub> = &Sigma; (F<sub>wc</sub> &times; h)</li>
            <li><strong>BM due to wind on pole:</strong> BM<sub>wp</sub> = F<sub>wp</sub> &times; (H<sub>above_ground</sub> / 2)</li>
            <li><strong>BM due to line tension:</strong> BM<sub>t</sub> = &Sigma; (F<sub>t</sub> &times; h)</li>
          </ul>

          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Ground-Line Moments for Pole #{currentPole.pole_no}:
            </div>
            &bull; BM Wind on Conductors: <strong>{bmWindCond.toFixed(2)} kNm</strong><br />
            &bull; BM Wind on Pole Shaft: <strong>{bmPole.toFixed(2)} kNm</strong><br />
            &bull; BM Line Tension / Angle: <strong>{bmTension.toFixed(2)} kNm</strong><br />
            &bull; BM Equipment (TF/LBS): <strong>{bmEquip.toFixed(2)} kNm</strong><br />
            &bull; <strong>Total Overturning Moment (BM<sub>total</sub>):</strong> {bmWindCond.toFixed(2)} + {bmPole.toFixed(2)} + {bmTension.toFixed(2)} + {bmEquip.toFixed(2)} = <strong style={{ color: 'var(--amber)', fontSize: '14px' }}>{totalBM.toFixed(2)} kNm</strong>
          </div>
        </div>

        {/* STEP 8 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              8
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 8 – Calculate Pole Top Load (daN)</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Equivalent Transverse Working Load</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            LECO ratings specify working capacity in daN applied at 0.3 m from pole top (effective height H<sub>eff</sub>):
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              P<sub>trans</sub> (daN) = ( BM<sub>total</sub> &times; 100 ) / H<sub>eff</sub>
            </div>
          </div>

          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Conversion for Pole #{currentPole.pole_no}:
            </div>
            &bull; Total Overturning Moment: <strong>{totalBM.toFixed(2)} kNm</strong><br />
            &bull; Effective Lever Arm (H<sub>eff</sub>): <strong>{(totalBM > 0 && poleTopLoad > 0 ? ((totalBM * 100) / poleTopLoad).toFixed(2) : '8.77')} m</strong><br />
            &bull; <strong>Equivalent Pole Top Load:</strong> <strong style={{ color: 'var(--amber)', fontSize: '15px' }}>{poleTopLoad.toFixed(1)} daN</strong>
          </div>
        </div>

        {/* STEP 9 */}
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              9
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 9 – Pole Strength and Buckling Check</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Safety Factor 2.5 on Buckling Load</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            The calculated load is compared against certified LECO pole classes and checked against vertical instability:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li>Compare with unguyed capacity of poles (200, 350, 500, 850, 1200 daN, etc.)</li>
            <li>Apply safety factor 2.5 on vertical buckling load: V<sub>demand</sub> = V<sub>vert</sub> &times; 2.5 &le; P<sub>buckling</sub></li>
            <li>Decide if guy is required when unguyed capacity is exceeded or terminal angle demands stay</li>
          </ul>

          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: '12.5px',
            fontFamily: 'var(--mono)'
          }}>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
              Actual Verification for Pole #{currentPole.pole_no} (P<sub>trans</sub> = {poleTopLoad.toFixed(1)} daN):
            </div>
            &bull; Unguyed Capacity Assessment: <strong>{currentPole.unguyed || (poleTopLoad <= 850 ? '850 daN class sufficient' : 'Exceeds standard single pole')}</strong><br />
            &bull; Vertical Load &amp; Buckling (SF = 2.5): Demand = <strong>{(currentPole.buckling_demand_kN || 0).toFixed(1)} kN</strong> vs Critical Capacity = <strong>{(currentPole.buckling_capacity_kN || 0).toFixed(1)} kN</strong> &rarr; <span style={{ color: currentPole.buckling_ok ? 'var(--ok)' : 'var(--danger)', fontWeight: 700 }}>{currentPole.buckling_ok ? 'PASS (Buckling Safe)' : 'FAIL / Exceeded'}</span><br />
            &bull; Guy Decision: <strong style={{ color: currentPole.guy_arrangement ? 'var(--amber)' : 'var(--ok)' }}>{currentPole.guy_arrangement || 'Unguyed (No stay wire needed)'}</strong>
          </div>
        </div>

        {/* STEP 10 */}
        <div className="card" style={{ padding: '24px 26px', borderLeft: '4px solid var(--ok)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--ok-dim)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              10
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 10 – Final Recommendation</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Certified Engineering Selection</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            The tool delivers the final certified specification for field construction:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.7, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>Recommended pole</strong> (11/500, 11/850, 11/1200, etc.)</li>
            <li><strong>Guy arrangement</strong> (Unguyed, Light Guy L, Medium M, Heavy H, 2H)</li>
            <li><strong>Foundation type</strong> (Type A direct bury, Type B encasement, or Type C pad)</li>
            <li><strong>Stringing table</strong> (Tension and sag at 27&deg;C ruling condition)</li>
          </ul>

          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid var(--ok)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            fontSize: '13px'
          }}>
            <div style={{ color: 'var(--ok)', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> Certified Selection for Pole #{currentPole.pole_no}:
            </div>
            &bull; Recommended Pole: <strong style={{ color: 'var(--ok)', fontSize: '14px' }}>{currentPole.recommended}</strong> (Economical: {currentPole.most_economic || currentPole.recommended})<br />
            &bull; Guy / Stay Arrangement: <strong>{currentPole.guy_arrangement || 'Unguyed'}</strong><br />
            &bull; Foundation Type: <strong>{typeof currentPole.foundation === 'object' ? `${currentPole.foundation.foundation_recommendation || 'Type A'} (Soil Class ${currentPole.soil || currentPole.foundation.soil_class || '4'}, Embedment: ${currentPole.foundation.embedment_m ? currentPole.foundation.embedment_m.toFixed(2) : '1.83'}m)` : (currentPole.foundation || 'Standard Embedment')}</strong><br />
            &bull; Ruling Stringing Sag at 27&deg;C: <strong>{sag27.toFixed(3)} m</strong> (Tension: {mainTen.toFixed(3)} kN)
          </div>
        </div>

      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '26px' }}>
        <button onClick={() => setActiveTab('results')}>
          <ArrowLeft size={15} /> Back: Results &amp; Reports
        </button>
        <button className="primary" onClick={() => setActiveTab('line')}>
          Review Route Input <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};
