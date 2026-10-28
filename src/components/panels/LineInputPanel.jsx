import React, { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { CSV } from '../../engine/csv.js';
import {
  Plus,
  FolderPlus,
  RotateCcw,
  Trash2,
  Play,
  Download,
  Upload,
  Mountain,
  GitBranch,
  MapPin,
  Ruler,
  Zap,
  Activity,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export const LineInputPanel = () => {
  const {
    lineRows,
    setLineRows,
    addPole,
    newSection,
    updatePole,
    deletePole,
    clearLine,
    loadSampleLine,
    runCalculation,
    calcError,
    setActiveModal,
    getParsedData,
    settings,
    setSettings,
    setActiveTab
  } = useApp();

  const fileInputRef = useRef(null);
  const data = getParsedData();
  const soilClasses = data.soil_classes || [];
  const equipmentList = data.equipment || [];
  const environments = (data.ground_clearances || []).map(g => g.environment).filter(Boolean);
  const uniqueEnvironments = [...new Set(environments)];

  // Route Metrics Calculation
  let totalRouteLength = 0;
  let angleChangesCount = 0;
  let tfCount = 0;
  lineRows.forEach(p => {
    totalRouteLength += (p.fore_span_m || 0);
    if (p.angle_deg > 0) angleChangesCount++;
    if (p.equipment && p.equipment.trim() !== '') tfCount++;
  });

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        try {
          const parsed = CSV.parseObjects(text).map((r, idx) => ({
            section: r.section || '1',
            pole_no: parseFloat(r.pole_no) || (idx + 1),
            aft_span_m: parseFloat(r.aft_span_m || 0),
            fore_span_m: parseFloat(r.fore_span_m || 0),
            elev_delta_m: parseFloat(r.elev_delta_m || 0),
            angle_deg: parseFloat(r.angle_deg || 0),
            soil_class: r.soil_class || '4',
            equipment: r.equipment || r.transformer_kva || '',
            span_environment: r.span_environment || 'along or across any road or street',
            guy_pole_angle_deg: parseFloat(r.guy_pole_angle_deg || 30),
            guy_theta_enabled: !!(r.guy_theta_enabled === 'true' || r.guy_theta_enabled === true),
            guy_theta_deg: parseFloat(r.guy_theta_deg || 0),
            survey_points: [],
            structure_points: [],
            spur_enabled: false,
            spur_circuits: [],
            crossarms: { HH: [], H: [] }
          }));
          setLineRows(parsed);
        } catch (err) {
          alert('Error parsing CSV: ' + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvExport = () => {
    const header = [
      'section',
      'pole_no',
      'aft_span_m',
      'fore_span_m',
      'elev_delta_m',
      'angle_deg',
      'soil_class',
      'equipment',
      'span_environment',
      'guy_pole_angle_deg',
      'guy_theta_enabled',
      'guy_theta_deg'
    ];
    const csvStr = CSV.objectsToCsv(lineRows, header);
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `line-route-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections = [...new Set(lineRows.map(r => r.section))];

  return (
    <div className="tab-panel">
      {/* Route Overview Stat Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon amber">
            <Ruler size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{totalRouteLength.toFixed(0)} m</span>
            <span className="kpi-label">Total Route Length</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon ok">
            <MapPin size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{lineRows.length}</span>
            <span className="kpi-label">Poles in {sections.length} Section{sections.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon info">
            <Activity size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{angleChangesCount}</span>
            <span className="kpi-label">Angle Deviation Poles</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon danger">
            <Zap size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{tfCount}</span>
            <span className="kpi-label">Transformers / Equipment</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <h2>Sequential Pole Route Editor</h2>
          <div className="btn-row" style={{ margin: 0 }}>
            <button className="primary" onClick={runCalculation}>
              <Play size={14} /> Calculate Pole Selections
            </button>
          </div>
        </div>

        <p className="hint">
          Define line spans sequentially. Fore span of pole <i>i</i> automatically links as aft span of pole <i>i+1</i>.
          Configure intermediate elevations, deviation angles, guy arrangements, and ground clearances.
        </p>

        {calcError && (
          <div style={{
            background: 'var(--danger-dim)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            fontFamily: 'var(--mono)',
            fontSize: '12px'
          }}>
            {calcError}
          </div>
        )}

        {/* Action Toolbar */}
        <div className="btn-row" style={{ marginBottom: '16px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="primary sm" onClick={addPole}><Plus size={13} /> Add Pole</button>
            <button className="sm" onClick={newSection}><FolderPlus size={13} /> New Section</button>
            <button className="sm" onClick={loadSampleLine}><RotateCcw size={13} /> Load Sample (13 Poles)</button>
            <button className="sm danger" onClick={clearLine}><Trash2 size={13} /> Clear</button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="sm" onClick={handleCsvExport}><Download size={13} /> Export CSV</button>
            <button className="sm" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> Import CSV</button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleCsvUpload}
            />
          </div>
        </div>

        {/* Line Table */}
        <div className="table-wrap" style={{ maxHeight: '56vh' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>Sec</th>
                <th style={{ width: '60px' }}>Pole #</th>
                <th>Aft (m)</th>
                <th>Fore (m)</th>
                <th>Elev &Delta; (m)</th>
                <th>Angle (&deg;)</th>
                <th>Soil Class</th>
                <th>Equipment</th>
                <th>Span Environment</th>
                <th>Guy to Pole</th>
                <th>Guy &theta; Transverse</th>
                <th>Survey Stations</th>
                <th>Spur Line</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lineRows.length === 0 ? (
                <tr>
                  <td colSpan="14" style={{ padding: '36px', color: 'var(--ink-muted)' }}>
                    No poles added yet. Click &quot;Add Pole&quot; or &quot;Load Sample&quot; to begin your line design.
                  </td>
                </tr>
              ) : (
                lineRows.map((pole, idx) => {
                  const hasSurvey = (pole.survey_points?.length || 0) + (pole.structure_points?.length || 0) > 0;
                  const hasSpur = pole.spur_enabled && (pole.spur_circuits?.length || 0) > 0;
                  const hasTf = pole.equipment && pole.equipment.trim() !== '';

                  return (
                    <tr key={idx}>
                      <td>
                        <span style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                          padding: '2px 6px',
                          background: 'var(--panel)',
                          border: '1px solid var(--line)',
                          borderRadius: '4px'
                        }}>
                          {pole.section}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', fontSize: '13px' }}>
                          P{pole.pole_no}
                        </strong>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          value={pole.aft_span_m}
                          onChange={(e) => updatePole(idx, { aft_span_m: parseFloat(e.target.value) || 0 })}
                          style={{ width: '65px', padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          value={pole.fore_span_m}
                          onChange={(e) => updatePole(idx, { fore_span_m: parseFloat(e.target.value) || 0 })}
                          style={{ width: '65px', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={pole.elev_delta_m}
                          onChange={(e) => updatePole(idx, { elev_delta_m: parseFloat(e.target.value) || 0 })}
                          style={{ width: '65px', padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          value={pole.angle_deg}
                          onChange={(e) => updatePole(idx, { angle_deg: parseFloat(e.target.value) || 0 })}
                          style={{ width: '60px', padding: '4px', textAlign: 'center', color: pole.angle_deg > 0 ? 'var(--amber)' : 'inherit', fontWeight: pole.angle_deg > 0 ? '700' : 'normal' }}
                        />
                      </td>
                      <td>
                        <select
                          value={pole.soil_class}
                          onChange={(e) => updatePole(idx, { soil_class: e.target.value })}
                          style={{ minWidth: '95px', padding: '4px', fontSize: '12px' }}
                        >
                          {soilClasses.map((s, i) => (
                            <option key={i} value={s.class}>Class {s.class} ({s.description || s.name || ''})</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={pole.equipment}
                          onChange={(e) => updatePole(idx, { equipment: e.target.value })}
                          style={{
                            minWidth: '135px',
                            padding: '4px',
                            fontSize: '12px',
                            color: hasTf ? 'var(--amber)' : 'inherit',
                            fontWeight: hasTf ? '700' : 'normal'
                          }}
                        >
                          <option value="">(None)</option>
                          {equipmentList.map((eq, i) => (
                            <option key={i} value={eq.equipment}>{eq.equipment}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={pole.span_environment}
                          onChange={(e) => updatePole(idx, { span_environment: e.target.value })}
                          style={{ minWidth: '175px', padding: '4px', fontSize: '12px' }}
                        >
                          {uniqueEnvironments.length > 0 ? (
                            uniqueEnvironments.map((env, i) => (
                              <option key={i} value={env}>{env}</option>
                            ))
                          ) : (
                            <option value="along or across any road or street">along or across any road or street</option>
                          )}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={pole.guy_pole_angle_deg}
                          onChange={(e) => updatePole(idx, { guy_pole_angle_deg: parseFloat(e.target.value) || 30 })}
                          style={{ width: '55px', padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={pole.guy_theta_enabled}
                            onChange={(e) => updatePole(idx, { guy_theta_enabled: e.target.checked })}
                          />
                          {pole.guy_theta_enabled && (
                            <input
                              type="number"
                              step="1"
                              value={pole.guy_theta_deg}
                              onChange={(e) => updatePole(idx, { guy_theta_deg: parseFloat(e.target.value) || 0 })}
                              style={{ width: '48px', padding: '2px 4px', textAlign: 'center', fontSize: '11px' }}
                            />
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`sm ${hasSurvey ? 'primary' : ''}`}
                          onClick={() => setActiveModal({ type: 'survey', poleIndex: idx })}
                        >
                          <Mountain size={12} /> {hasSurvey ? 'Survey (' + (pole.survey_points?.length || 0) + ')' : 'Survey'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`sm ${hasSpur ? 'primary' : ''}`}
                          onClick={() => setActiveModal({ type: 'spur', poleIndex: idx })}
                        >
                          <GitBranch size={12} /> {hasSpur ? 'Spur Active' : 'Spur'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="danger sm"
                          onClick={() => deletePole(idx)}
                          title="Delete pole"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section Tension Factors */}
        <div style={{
          marginTop: '20px',
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px'
        }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Section Line Tension Factors (%)
          </h4>
          <p className="hint" style={{ marginTop: 0 }}>
            Fine-tune stringing tension per section (default 100%). Values &lt;100% allow intentional loose sagging on specific spans.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {sections.map((sec) => (
              <div
                key={sec}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--panel)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line)'
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--ink)' }}>Section {sec}:</span>
                <input
                  type="number"
                  step="5"
                  min="20"
                  max="150"
                  defaultValue="100"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 100;
                    setSettings(prev => ({
                      ...prev,
                      tension_factors: {
                        ...prev.tension_factors,
                        [sec]: { 'H:0': val, 'HH:0': val, 'L:0': val }
                      }
                    }));
                  }}
                  style={{ width: '65px', padding: '3px 6px', textAlign: 'center' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Guided Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          <button onClick={() => setActiveTab('construction')}>
            <ArrowLeft size={15} /> Back: Construction Data
          </button>
          <button className="primary" onClick={runCalculation} style={{ padding: '10px 24px', fontSize: '14px' }}>
            <Play size={15} /> Calculate &amp; View Results <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
