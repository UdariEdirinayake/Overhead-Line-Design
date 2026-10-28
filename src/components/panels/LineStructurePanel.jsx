import React from 'react';
import { useApp } from '../../context/AppContext';
import { Calc } from '../../engine/calculation.js';
import {
  FolderKanban,
  GitFork,
  Radio,
  Zap,
  ShieldCheck,
  ArrowRight,
  Plus,
  Trash2,
  Info
} from 'lucide-react';

export const LineStructurePanel = () => {
  const {
    projectInfo,
    setProjectInfo,
    lineStructureMode,
    setLineStructureMode,
    commonSections,
    setCommonSections,
    settings,
    setSettings,
    getParsedData,
    setActiveTab
  } = useApp();

  const data = getParsedData();
  const configs = data.configs || [];
  const conductors = data.conductors || [];
  const insulators = data.insulators || [];

  const currentConfig = configs.find(c => String(c.config_no) === String(settings.config_no)) || configs[0] || {};
  const circuitId = Calc.identifyCircuits(currentConfig);

  const handleProjectChange = (field, val) => {
    setProjectInfo(prev => ({ ...prev, [field]: val }));
  };

  const handleConfigChange = (newConfigNo) => {
    const cfg = configs.find(c => String(c.config_no) === String(newConfigNo)) || {};
    const cId = Calc.identifyCircuits(cfg);
    const newByBand = { HH: [], H: [], L: [] };
    cId.circuits.forEach(circ => {
      let defaultCode = conductors[0]?.code || '6';
      if (circ.band === 'HH') {
        defaultCode = conductors.find(c => c.description?.includes('Lynx') || c.code === '7')?.code || '7';
      } else if (circ.band === 'H') {
        defaultCode = conductors.find(c => c.description?.includes('Racoon') || c.code === '6')?.code || '6';
      } else {
        defaultCode = conductors.find(c => c.description?.includes('Weasel') || c.code === '4')?.code || '4';
      }
      newByBand[circ.band].push(defaultCode);
    });

    setSettings(prev => ({
      ...prev,
      config_no: newConfigNo,
      conductors_by_band: newByBand,
      conductor_HH: newByBand.HH[0] || '',
      conductor_H: newByBand.H[0] || '',
      conductor_LV: newByBand.L[0] || ''
    }));
  };

  const handleConductorChange = (band, circuitIndex, code) => {
    setSettings(prev => {
      const byBand = { ...prev.conductors_by_band };
      const arr = [...(byBand[band] || [])];
      arr[circuitIndex] = code;
      byBand[band] = arr;
      return {
        ...prev,
        conductors_by_band: byBand,
        conductor_HH: byBand.HH?.[0] || '',
        conductor_H: byBand.H?.[0] || '',
        conductor_LV: byBand.L?.[0] || ''
      };
    });
  };

  const addCommonSectionRow = () => {
    setCommonSections(prev => {
      const last = prev[prev.length - 1];
      const nextNo = last ? (last.no + 1) : 1;
      const startP = last ? last.end_pole : 1;
      const endP = startP + 5;
      return [
        ...prev,
        {
          no: nextNo,
          start_pole: startP,
          end_pole: endP,
          config_no: configs[0]?.config_no || '1'
        }
      ];
    });
  };

  const updateCommonSection = (index, field, val) => {
    setCommonSections(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const deleteCommonSection = (index) => {
    setCommonSections(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="tab-panel">
      {/* 1. PROJECT DETAILS */}
      <div className="card">
        <div className="card-header-row">
          <h2>
            <FolderKanban size={16} /> Project Identification &amp; Metadata
          </h2>
        </div>
        <p className="hint">
          Enter project identifiers for report documentation and export sheets.
        </p>

        <div className="grid-3">
          <div className="field">
            <label>Project Area Name</label>
            <input
              type="text"
              placeholder="e.g. Colombo South"
              value={projectInfo.project}
              onChange={(e) => handleProjectChange('project', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Line Route / Feeder Description</label>
            <input
              type="text"
              placeholder="e.g. Nawala–Nugegoda 33 kV Feeder"
              value={projectInfo.lineName}
              onChange={(e) => handleProjectChange('lineName', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Job Number</label>
            <input
              type="text"
              placeholder="e.g. J-2026-0142"
              value={projectInfo.jobNo}
              onChange={(e) => handleProjectChange('jobNo', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Design Number</label>
            <input
              type="text"
              placeholder="e.g. DES-33kV-008"
              value={projectInfo.designNo}
              onChange={(e) => handleProjectChange('designNo', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Revision Number</label>
            <input
              type="text"
              placeholder="e.g. Rev A"
              value={projectInfo.revNo}
              onChange={(e) => handleProjectChange('revNo', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Budget Allocation Code</label>
            <input
              type="text"
              placeholder="e.g. BGT-2026-55"
              value={projectInfo.budgetNo}
              onChange={(e) => handleProjectChange('budgetNo', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. ROUTE STRUCTURE MODE */}
      <div className="card">
        <h2>
          <GitFork size={16} /> Line Route Structure Mode
        </h2>
        <p className="hint">
          Choose whether this line uses a continuous single pole configuration or multiple configuration sections.
        </p>

        <div className="grid-2" style={{ marginBottom: '10px' }}>
          <div
            className={`selection-card ${lineStructureMode === 'legacy' ? 'selected' : ''}`}
            onClick={() => setLineStructureMode('legacy')}
          >
            <div className="selection-indicator">
              {lineStructureMode === 'legacy' && <Zap size={12} />}
            </div>
            <div>
              <div className="selection-card-title">Standard / Legacy Route</div>
              <div className="selection-card-desc">
                Single pole and circuit configuration along the entire feeder route. Best for standard single-voltage or standard bundled distribution lines.
              </div>
            </div>
          </div>

          <div
            className={`selection-card ${lineStructureMode === 'common' ? 'selected' : ''}`}
            onClick={() => setLineStructureMode('common')}
          >
            <div className="selection-indicator">
              {lineStructureMode === 'common' && <Zap size={12} />}
            </div>
            <div>
              <div className="selection-card-title">Common Sections Route</div>
              <div className="selection-card-desc">
                Enables multiple pole configurations along different spans of the line with distinct stringing sections and transition poles.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONFIGURATION & CONDUCTORS */}
      {lineStructureMode === 'legacy' ? (
        <>
          <div className="card">
            <h2>
              <Zap size={16} /> Circuit &amp; Pole Configuration
            </h2>
            <p className="hint">
              Select the pole height, circuit stages, and conductor spacing layout from the standard LECO catalog.
            </p>

            <div style={{ maxWidth: '640px', marginBottom: '16px' }}>
              <label>Selected Configuration</label>
              <select
                value={settings.config_no}
                onChange={(e) => handleConfigChange(e.target.value)}
                style={{ fontSize: '14px', fontWeight: '600' }}
              >
                {configs.map((cfg) => (
                  <option key={cfg.config_no} value={cfg.config_no}>
                    Config #{cfg.config_no} &mdash; {cfg.description} (Pole Height: {cfg.pole_height_m}m)
                  </option>
                ))}
              </select>
            </div>

            {/* Configuration Preview Badge Card */}
            <div style={{
              background: 'var(--panel-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--ink-muted)', display: 'block' }}>NOMINAL POLE HEIGHT</span>
                <strong style={{ fontSize: '18px', fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{currentConfig.pole_height_m} metres</strong>
              </div>
              <div style={{ width: '1px', height: '32px', background: 'var(--line)' }}></div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--ink-muted)', display: 'block' }}>CIRCUIT STAGES</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                  {Number(currentConfig.levels_HH) > 0 && <span className="badge-voltage v33">33 kV &times; {currentConfig.levels_HH}</span>}
                  {Number(currentConfig.levels_H) > 0 && <span className="badge-voltage v11">11 kV &times; {currentConfig.levels_H}</span>}
                  {Number(currentConfig.levels_L) > 0 && <span className="badge-voltage vlv">LV &times; {currentConfig.levels_L}</span>}
                </div>
              </div>
              <div style={{ width: '1px', height: '32px', background: 'var(--line)' }}></div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--ink-muted)', display: 'block' }}>ATTACHMENT HEIGHTS</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--ink-dim)' }}>
                  {currentConfig.heights_m ? currentConfig.heights_m.replace(/;/g, 'm, ') + 'm' : 'Standard'}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>
              <ShieldCheck size={16} /> Conductor &amp; Insulator Selection
            </h2>
            <p className="hint">
              Select conductor types for each identified circuit stage and appropriate pin/post insulators.
            </p>

            <div className="grid-3" style={{ marginBottom: '22px' }}>
              {circuitId.circuits.map((circ, idx) => {
                const bandCode = circ.band;
                const bandIdx = circuitId.circuits.filter((c, i) => i < idx && c.band === bandCode).length;
                const selected = settings.conductors_by_band?.[bandCode]?.[bandIdx] || conductors[0]?.code;
                const badgeClass = bandCode === 'HH' ? 'v33' : bandCode === 'H' ? 'v11' : 'vlv';

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--panel-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className={`badge-voltage ${badgeClass}`}>
                        {circ.band === 'HH' ? '33 kV' : circ.band === 'H' ? '11 kV' : 'LV'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--ink-muted)', fontFamily: 'var(--mono)' }}>
                        N = {circ.nConductors}
                      </span>
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ink)' }}>{circ.label}</label>

                    <select
                      value={selected}
                      onChange={(e) => handleConductorChange(bandCode, bandIdx, e.target.value)}
                      style={{ marginTop: '6px' }}
                    >
                      {conductors.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} &mdash; {c.description} (UTS {c.Ultimate_Tensile_Strength_daN || c.UTS_daN} daN)
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <h3 style={{ fontSize: '13px', color: 'var(--amber)', margin: '18px 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Insulator Ratings &amp; Fitting Specifications
            </h3>
            <div className="grid-2">
              {Number(currentConfig.levels_HH) > 0 && (
                <div className="field">
                  <label>33 kV Insulator Standard</label>
                  <select
                    value={settings.insulator_HH_desc}
                    onChange={(e) => setSettings(prev => ({ ...prev, insulator_HH_desc: e.target.value }))}
                  >
                    {insulators.filter(i => String(i.voltage_level_kV).includes('33')).map((ins, i) => (
                      <option key={i} value={ins.description}>
                        {ins.description} (Cantilever: {ins.cantilever_strength_kN} kN)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {Number(currentConfig.levels_H) > 0 && (
                <div className="field">
                  <label>11 kV Insulator Standard</label>
                  <select
                    value={settings.insulator_H_desc}
                    onChange={(e) => setSettings(prev => ({ ...prev, insulator_H_desc: e.target.value }))}
                  >
                    {insulators.filter(i => String(i.voltage_level_kV).includes('11')).map((ins, i) => (
                      <option key={i} value={ins.description}>
                        {ins.description} (Cantilever: {ins.cantilever_strength_kN} kN)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* COMMON SECTIONS TABLE */
        <div className="card">
          <div className="card-header-row">
            <h2>Common Sections Configuration Schedule</h2>
            <button className="primary sm" onClick={addCommonSectionRow}>
              <Plus size={13} /> + Add Section
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Section #</th>
                  <th>Start Pole</th>
                  <th>End Pole</th>
                  <th>Pole Configuration Layout</th>
                  <th style={{ width: '45px' }}></th>
                </tr>
              </thead>
              <tbody>
                {commonSections.map((cs, i) => (
                  <tr key={i}>
                    <td><b>Section {cs.no}</b></td>
                    <td>
                      <input
                        type="number"
                        value={cs.start_pole}
                        onChange={(e) => updateCommonSection(i, 'start_pole', parseInt(e.target.value) || 1)}
                        style={{ width: '70px', textAlign: 'center' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={cs.end_pole}
                        onChange={(e) => updateCommonSection(i, 'end_pole', parseInt(e.target.value) || 1)}
                        style={{ width: '70px', textAlign: 'center' }}
                      />
                    </td>
                    <td>
                      <select
                        value={cs.config_no}
                        onChange={(e) => updateCommonSection(i, 'config_no', e.target.value)}
                        style={{ minWidth: '320px' }}
                      >
                        {configs.map((c) => (
                          <option key={c.config_no} value={c.config_no}>
                            Config #{c.config_no} &mdash; {c.description} ({c.pole_height_m}m)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="danger sm" onClick={() => deleteCommonSection(i)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guided Workflow Navigation Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button
          className="primary"
          onClick={() => setActiveTab('design')}
          style={{ padding: '10px 22px', fontSize: '14px' }}
        >
          Next: Design Parameters <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};
