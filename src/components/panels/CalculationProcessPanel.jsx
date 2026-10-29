import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BookOpen,
  Calculator,
  Layers,
  TableProperties,
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
  Info
} from 'lucide-react';

export const CalculationProcessPanel = () => {
  const { results, lineRows, settings, runCalculation, setActiveTab } = useApp();

  const [selectedPoleIdx, setSelectedPoleIdx] = useState(0);
  const [showWorkedExample, setShowWorkedExample] = useState(true);

  const hasResults = !!(results && results.results && results.results.length > 0);
  const poleRows = hasResults ? results.results : [];
  const currentPole = hasResults && poleRows[selectedPoleIdx] ? poleRows[selectedPoleIdx] : null;

  // Find poles in the same section as selected pole
  const currentSection = currentPole ? currentPole.section : (lineRows[0]?.section || '1');
  const sectionPoles = lineRows.filter(r => String(r.section) === String(currentSection));
  const sectionForeSpans = sectionPoles.map(r => Number(r.fore_span_m || 0)).filter(s => s > 0);
  const sumL = sectionForeSpans.reduce((a, b) => a + b, 0);
  const sumL3 = sectionForeSpans.reduce((a, b) => a + Math.pow(b, 3), 0);
  const calcLeq = sumL > 0 ? Math.sqrt(sumL3 / sumL) : 0;

  return (
    <div className="tab-panel">
      {/* Header Banner */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--amber)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--amber)', marginBottom: '6px' }}>
              <BookOpen size={18} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Engineering Reference &amp; Educational Workflow
              </span>
            </div>
            <h1 style={{ fontSize: '20px', margin: '0 0 8px', color: 'var(--ink)' }}>
              Calculation Process – How the Tool Works
            </h1>
            <p style={{ margin: 0, color: 'var(--ink-dim)', fontSize: '13px', lineHeight: 1.6, maxWidth: '820px' }}>
              This page explains the exact calculation sequence used by the software when you click <strong>Run Calculation</strong>. It follows the certified methodology defined in the <strong>LECO Overhead Line Construction Standards Manual</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {hasResults ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--panel-2)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>Mode:</span>
                <button
                  className={`sm ${showWorkedExample ? 'primary' : ''}`}
                  onClick={() => setShowWorkedExample(!showWorkedExample)}
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                >
                  <Sparkles size={12} /> {showWorkedExample ? 'Live Worked Example: ON' : 'Formulas Only'}
                </button>
              </div>
            ) : (
              <button className="primary sm" onClick={runCalculation}>
                <Calculator size={13} /> Run Calculation to View Live Numbers
              </button>
            )}
          </div>
        </div>

        {/* Live Example Pole Selector (if results available and active) */}
        {hasResults && showWorkedExample && (
          <div style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--amber)' }}>
                Inspect Ran Pole Example:
              </span>
              <select
                value={selectedPoleIdx}
                onChange={(e) => setSelectedPoleIdx(Number(e.target.value))}
                style={{ width: 'auto', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
              >
                {poleRows.map((p, idx) => (
                  <option key={idx} value={idx}>
                    Pole #{p.pole_no} — Section {p.section} ({p.angle ? `${p.angle}° Angle` : 'Tangent'}, Span: {p.aft || 0}m / {p.fore || 0}m)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>
              Showing live calculated substitution values for <strong>Pole #{currentPole?.pole_no}</strong> in Section {currentPole?.section}.
            </div>
          </div>
        )}
      </div>

      {/* 10 Step Detailed Calculation Sequence */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* STEP 1 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              1
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 1 – Group Poles into Sections</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Tension Section Partitioning</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            A distribution line is divided into mechanical tension sections between termination or tension points. The software groups poles using the <strong>Section numbers</strong> entered by the user in the Route Input. All consecutive poles within the same section number form a continuous ruling tension run.
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: '12.5px', color: 'var(--ink)' }}>
            <span style={{ color: 'var(--amber)' }}>Rule:</span> Section = Input column [section]. Each boundary between section numbers indicates a section or terminal pole.
          </div>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Pole #{currentPole.pole_no}:</strong> Belongs to <strong>Section {currentPole.section}</strong>.
              Total poles in this section: {sectionPoles.length} (Poles: {sectionPoles.map(p => `#${p.pole_no}`).join(', ')}).
            </div>
          )}
        </div>

        {/* STEP 2 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              2
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 2 – Calculate Equivalent Span for Each Section</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Ruling Span Formulation</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Conductor tension along a series of suspension supports equalizes to that of a single uniform span known as the <strong>Equivalent (Ruling) Span</strong> (L<sub>eq</sub>). It is calculated from the fore spans of all poles within the tension section.
          </p>

          {/* Equation Box */}
          <div style={{ background: 'var(--panel-2)', padding: '16px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              L<sub>eq</sub> = &radic;( &Sigma; L<sub>i</sub>&sup3; / &Sigma; L<sub>i</sub> )
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              where <strong>L<sub>i</sub></strong> = individual fore spans of the spans inside that section (meters).
            </div>
          </div>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Section {currentPole.section}:</strong><br />
              Fore spans in section: [{sectionForeSpans.join('m, ')}m]<br />
              &Sigma; L<sub>i</sub> = {sumL.toFixed(1)} m &bull; &Sigma; L<sub>i</sub>&sup3; = {sumL3.toLocaleString(undefined, { maximumFractionDigits: 1 })} m&sup3;<br />
              <strong>L<sub>eq</sub> = &radic;({sumL3.toFixed(1)} / {sumL.toFixed(1)}) = {(currentPole.eq_span || calcLeq).toFixed(2)} m</strong>
            </div>
          )}
        </div>

        {/* STEP 3 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              3
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 3 – Look up Tension and Sag from Span–Tension Tables</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Linear Interpolation on Certified Charts</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Using the calculated <strong>L<sub>eq</sub></strong> for the section, the software queries the certified <strong>Span–Tension lookup table</strong> corresponding to the configured conductor code (e.g. UC-7.90, UD-2.74, ABC-70, etc.). It performs linear interpolation between adjacent span rows:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>Tension at 15&deg;C + Wind:</strong> Maximum design working tension used for wind and angle transverse load calculations.</li>
            <li><strong>Sag at 65&deg;C:</strong> Maximum sag condition at peak temperature, used for critical ground and vertical clearance verification.</li>
            <li><strong>Sag at 27&deg;C:</strong> Ruling stringing sag at average ambient temperature, used for stringing charts and installation inspection.</li>
          </ul>

          <div style={{ background: 'var(--panel-2)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-dim)' }}>
            Interpolation Formula: Y = Y<sub>1</sub> + [ (L<sub>eq</sub> - L<sub>1</sub>) / (L<sub>2</sub> - L<sub>1</sub>) ] &times; (Y<sub>2</sub> - Y<sub>1</sub>)
          </div>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Section {currentPole.section} (L<sub>eq</sub> = {(currentPole.eq_span || calcLeq).toFixed(2)} m):</strong><br />
              Working Tension (T<sub>15&deg;C+Wind</sub>): <strong>{(currentPole.tension_H_kN || currentPole.tension_HH_kN || currentPole.tension_L_kN || 0).toFixed(3)} kN</strong><br />
              Sag at 65&deg;C on L<sub>eq</sub>: <strong>{(currentPole.sag65_m ? (currentPole.sag65_m[0] ?? currentPole.sag65_m) : 'Lookup value')} m</strong>
            </div>
          )}
        </div>

        {/* STEP 4 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              4
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 4 – Calculate Sag on Each Individual Span</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Parabolic Sag Scaling Law</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Because tension is uniform throughout the section, sag on each individual span varies proportionally to the square of its actual length. The sag is scaled from the equivalent span sag using the standard catenary/parabolic relation:
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '16px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              Sag<sub>actual</sub> = Sag<sub>eq</sub> &times; ( L<sub>actual</sub> / L<sub>eq</sub> )&sup2;
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              Calculated for every individual fore span to verify exact mid-span ground and obstacle clearance.
            </div>
          </div>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Pole #{currentPole.pole_no}:</strong><br />
              Actual Fore Span (L<sub>actual</sub>): <strong>{currentPole.fore || 0} m</strong> &bull; L<sub>eq</sub>: <strong>{(currentPole.eq_span || calcLeq).toFixed(2)} m</strong><br />
              Scaling Factor (L<sub>actual</sub> / L<sub>eq</sub>)&sup2; = {calcLeq > 0 ? (Math.pow((currentPole.fore || 0) / (currentPole.eq_span || calcLeq), 2)).toFixed(3) : 0}<br />
              Calculated Max Sag (65&deg;C): <strong>{(currentPole.max_sag_m || currentPole.lowest_clearance_m ? (currentPole.sag65_m ? Number(currentPole.sag65_m[0] || 0).toFixed(2) : '0.00') : '0.00')} m</strong>
            </div>
          )}
        </div>

        {/* STEP 5 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              5
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 5 – Calculate Wind Span and Weight Span</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Span Load Distribution</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            The mechanical loads acting on any intermediate pole depend on the length of conductor contributing horizontal wind force (Wind Span) and vertical gravity weight (Weight Span).
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '16px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              Wind Span = Weight Span = ( After Span + Fore Span ) / 2
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              (On level ground. Terminal poles take half of the single adjacent span: L / 2).
            </div>
          </div>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Pole #{currentPole.pole_no}:</strong><br />
              After Span = {currentPole.aft || 0} m &bull; Fore Span = {currentPole.fore || 0} m<br />
              <strong>Wind Span = ({(currentPole.aft || 0)} + {(currentPole.fore || 0)}) / 2 = {(currentPole.wind_span || 0).toFixed(2)} m</strong><br />
              <strong>Weight Span = {(currentPole.weight_span || currentPole.wind_span || 0).toFixed(2)} m</strong>
            </div>
          )}
        </div>

        {/* STEP 6 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              6
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 6 – Calculate Forces on the Pole</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Transverse Wind &amp; Tension Vector Resolution</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            All transverse forces pushing horizontally against the structure are computed:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>Wind force on conductors:</strong> F<sub>wc</sub> = P<sub>wind</sub> &times; d<sub>conductor</sub> &times; Wind Span &times; n<sub>conductors</sub></li>
            <li><strong>Wind force on pole &amp; equipment:</strong> F<sub>wp</sub> = P<sub>pole</sub> &times; Area<sub>pole</sub> + P<sub>wind</sub> &times; Area<sub>equip</sub></li>
            <li>
              <strong>Transverse force due to line deviation angle (&theta;):</strong>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--amber)', margin: '4px 0 0' }}>
                F<sub>t</sub> = 2 &times; T &times; sin( &theta; / 2 )
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>
                where <strong>T</strong> = working line tension at 15&deg;C + Wind, and <strong>&theta;</strong> = deviation angle in degrees.
              </span>
            </li>
          </ul>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Pole #{currentPole.pole_no}:</strong><br />
              Line Angle (&theta;) = {currentPole.angle || 0}&deg; &bull; Working Tension (T) = {(currentPole.tension_H_kN || currentPole.tension_HH_kN || currentPole.tension_L_kN || 0).toFixed(3)} kN<br />
              Angle Deviation Force (F<sub>t</sub>): <strong>{(2 * (currentPole.tension_H_kN || currentPole.tension_HH_kN || currentPole.tension_L_kN || 0) * 1000 * Math.sin(((currentPole.angle || 0) * Math.PI) / 360) / 9.80665).toFixed(1)} daN</strong> (approx)<br />
              {currentPole.is_terminal ? <span>Terminal Pole: Full line tension acts longitudinally.</span> : null}
            </div>
          )}
        </div>

        {/* STEP 7 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              7
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 7 – Calculate Bending Moments</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Ground-Line Moment Summation</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Each horizontal force creates a overturning bending moment about the ground line equal to the force multiplied by its mounting height above ground (lever arm):
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>BM due to wind on conductors:</strong> BM<sub>wc</sub> = &Sigma; ( F<sub>wc,i</sub> &times; h<sub>i</sub> )</li>
            <li><strong>BM due to wind on pole shaft:</strong> BM<sub>wp</sub> = F<sub>wp</sub> &times; ( H<sub>above_ground</sub> / 2 )</li>
            <li><strong>BM due to line tension / angle:</strong> BM<sub>t</sub> = &Sigma; ( F<sub>t,i</sub> &times; h<sub>i</sub> )</li>
            <li><strong>Total Overturning Moment:</strong> BM<sub>total</sub> = BM<sub>wc</sub> + BM<sub>wp</sub> + BM<sub>t</sub> + BM<sub>equip</sub></li>
          </ul>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Pole #{currentPole.pole_no}:</strong><br />
              BM Wind on Conductors: <strong>{(currentPole.bm_wind_cond_kNm || 0).toFixed(2)} kNm</strong><br />
              BM Wind on Pole: <strong>{(currentPole.bm_pole_kNm || 0).toFixed(2)} kNm</strong><br />
              BM Tension / Angle: <strong>{(currentPole.bm_tension_kNm || 0).toFixed(2)} kNm</strong><br />
              BM Equipment: <strong>{(currentPole.bm_equip_kNm || 0).toFixed(2)} kNm</strong>
            </div>
          )}
        </div>

        {/* STEP 8 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              8
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 8 – Calculate Pole Top Load (daN)</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Equivalent Transverse Top Demand</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            LECO standard pole capacities are rated in <strong>daN</strong> applied at 0.3 m from the pole top (or effective top mounting height). The total ground-line bending moment is converted into an equivalent transverse point load:
          </p>

          <div style={{ background: 'var(--panel-2)', padding: '16px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '15px', color: 'var(--amber)', fontWeight: 600, marginBottom: '6px' }}>
              P<sub>transverse</sub> (daN) = [ Total BM (kNm) &times; 100 ] / H<sub>effective</sub>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              Note: 1 kNm &approx; 101.97 daNm (or standard 100 multiplier per LECO convention).
            </div>
          </div>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Pole #{currentPole.pole_no}:</strong><br />
              Calculated Equivalent Top Transverse Load: <strong style={{ color: 'var(--amber)', fontSize: '14px' }}>{(currentPole.pole_top_load_daN || 0).toFixed(1)} daN</strong>
            </div>
          )}
        </div>

        {/* STEP 9 */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--amber-dim)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              9
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 9 – Pole Strength and Buckling Check</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Capacity Comparison &amp; Safety Verification</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            The calculated load is compared against certified LECO pole classes and checked against vertical instability:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>Compare with unguyed capacity:</strong> Checks available standard unguyed classes (e.g. 200, 350, 500, 850, 1200 daN, or double-pole 2x850, 2x1200 daN).</li>
            <li>
              <strong>Euler Buckling Check:</strong> Total vertical downward load (conductor weight + pole weight + equipment + guy vertical pull) is verified against critical buckling capacity:
              <div style={{ fontFamily: 'var(--mono)', fontSize: '13.5px', color: 'var(--amber)', margin: '4px 0 0' }}>
                V<sub>demand</sub> = Vertical Load &times; 2.5 (Safety Factor = 2.5) &le; P<sub>critical_buckling</sub>
              </div>
            </li>
            <li><strong>Decide if Guy is required:</strong> If transverse load exceeds maximum allowable unguyed capacity or if line angle / terminal tension demands it, the software introduces a guy wire arrangement (Light, Medium, Heavy, 2xHeavy).</li>
          </ul>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--amber)', fontSize: '12.5px' }}>
              <strong style={{ color: 'var(--amber)' }}>Ran Example for Pole #{currentPole.pole_no}:</strong><br />
              Unguyed Assessment: <strong>{currentPole.unguyed || 'N/A'}</strong><br />
              Buckling Check: Vertical demand = {(currentPole.buckling_demand_kN || 0).toFixed(1)} kN vs Capacity = {(currentPole.buckling_capacity_kN || 0).toFixed(1)} kN &rarr; <strong>{currentPole.buckling_ok ? 'PASS (Safe with 2.5 factor)' : 'FAIL / Requires Guy'}</strong><br />
              Guy Requirement: <strong>{currentPole.guy_arrangement || 'None (Unguyed is sufficient)'}</strong>
            </div>
          )}
        </div>

        {/* STEP 10 */}
        <div className="card" style={{ padding: '22px 24px', borderLeft: '3px solid var(--ok)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--ok-dim)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', fontFamily: 'var(--mono)' }}>
              10
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>Step 10 – Final Recommendation</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Optimum Engineering Selection</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.6, margin: '0 0 14px' }}>
            The software outputs the final certified structural specification for construction:
          </p>

          <ul style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: '20px' }}>
            <li><strong>Recommended Pole:</strong> The most economical compliant concrete pole class (e.g., 11/350 U, 11/500 U, 11/850 U, 11/1200 U, or guyed counterpart).</li>
            <li><strong>Guy Arrangement:</strong> Exact stay type (Light L, Medium M, Heavy H, or 2H) and lead angle if required.</li>
            <li><strong>Foundation Type:</strong> Direct bury depth, concrete encasement, or precast footing based on soil classification (Class 1 to 5).</li>
            <li><strong>Stringing Table:</strong> 27&deg;C sag and tension values provided for field linemen to pull conductors accurately.</li>
          </ul>

          {hasResults && showWorkedExample && currentPole && (
            <div style={{ padding: '14px 16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ok)', fontSize: '13px' }}>
              <div style={{ fontWeight: 700, color: 'var(--ok)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Certified Selection for Pole #{currentPole.pole_no}:
              </div>
              &bull; Recommended Pole: <strong>{currentPole.recommended}</strong> ({currentPole.most_economic || currentPole.recommended})<br />
              &bull; Stay / Guy: <strong>{currentPole.guy_arrangement || 'Unguyed'}</strong><br />
              &bull; Foundation: <strong>{currentPole.foundation || 'Standard Soil Embedment'}</strong>
            </div>
          )}
        </div>

      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
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
