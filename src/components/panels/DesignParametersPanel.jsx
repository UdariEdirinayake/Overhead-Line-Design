import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Sliders,
  Wind,
  Compass,
  Thermometer,
  Gauge,
  ArrowRight,
  ArrowLeft,
  Info
} from 'lucide-react';

export const DesignParametersPanel = () => {
  const {
    settings,
    setSettings,
    isDesignUnlocked,
    setIsDesignUnlocked,
    setActiveTab
  } = useApp();

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passwordInput === '000') {
      setIsDesignUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleFieldChange = (field, val) => {
    setSettings(prev => ({ ...prev, [field]: val }));
  };

  const handleUserGcChange = (band, val) => {
    setSettings(prev => ({
      ...prev,
      user_gc: { ...prev.user_gc, [band]: parseFloat(val) || 0 }
    }));
  };

  const handleUserCcChange = (pair, val) => {
    setSettings(prev => ({
      ...prev,
      user_cc: { ...prev.user_cc, [pair]: parseFloat(val) || 0 }
    }));
  };

  return (
    <div className="tab-panel">
      <div className="card">
        <div className="card-header-row">
          <h2>
            <Sliders size={16} /> Environmental Loads &amp; Design Criteria
          </h2>
          {isDesignUnlocked ? (
            <button className="sm" onClick={() => setIsDesignUnlocked(false)} style={{ color: 'var(--ok)' }}>
              <Unlock size={13} /> Parameters Unlocked
            </button>
          ) : (
            <button className="sm" onClick={() => { setIsDesignUnlocked(true); setPasswordError(false); }}>
              <Lock size={13} /> Quick Unlock (Default: 000)
            </button>
          )}
        </div>

        <p className="hint">
          Configure regional wind pressures, temperature extremes, conductor maximum stress limits (% UTS), and regulatory clearance criteria.
        </p>

        {!isDesignUnlocked && (
          <div style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={20} style={{ color: 'var(--amber)' }} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Engineering Parameters Protection</strong>
                <div style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>
                  Parameters are locked to standard LECO guidelines. Enter password to adjust values.
                </div>
              </div>
            </div>

            <form onSubmit={handleUnlock} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="password"
                placeholder="Password (000)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{ width: '140px', padding: '6px 10px', fontSize: '12.5px' }}
              />
              <button type="submit" className="primary sm">Unlock</button>
            </form>
          </div>
        )}

        <div style={{ opacity: isDesignUnlocked ? 1 : 0.75, pointerEvents: isDesignUnlocked ? 'auto' : 'none' }}>
          {/* Calculation Methodology Selector */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'var(--ink)' }}>
              Calculation Methodology
            </label>
            <div className="grid-2">
              <div
                className={`selection-card ${settings.calc_method === 'leco_standard' ? 'selected' : ''}`}
                onClick={() => handleFieldChange('calc_method', 'leco_standard')}
              >
                <div className="selection-indicator">
                  {settings.calc_method === 'leco_standard' && <ShieldCheck size={12} />}
                </div>
                <div>
                  <div className="selection-card-title">LECO Standard (Sag–Tension Charts)</div>
                  <div className="selection-card-desc">
                    Interpolates conductor everyday tension (EDT) and 15&deg;C+wind tension directly from certified empirical ruling span lookup tables.
                  </div>
                </div>
              </div>

              <div
                className={`selection-card ${settings.calc_method === 'clearance_based' ? 'selected' : ''}`}
                onClick={() => handleFieldChange('calc_method', 'clearance_based')}
              >
                <div className="selection-indicator">
                  {settings.calc_method === 'clearance_based' && <ShieldCheck size={12} />}
                </div>
                <div>
                  <div className="selection-card-title">Clearance-Based Tension Design</div>
                  <div className="selection-card-desc">
                    Derives optimal conductor tension from statutory ground clearance envelope and solves catenary state-change equations up to 65&deg;C.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wind Pressures & Guy Angles */}
          <h3 style={{ fontSize: '13px', color: 'var(--amber)', margin: '22px 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Environmental Wind Pressures &amp; Guy Arrangement
          </h3>
          <div className="grid-3">
            <div className="field">
              <label>Conductor Wind Pressure (N/m&sup2;)</label>
              <input
                type="number"
                value={settings.wind_pressure_Nm2}
                onChange={(e) => handleFieldChange('wind_pressure_Nm2', parseFloat(e.target.value) || 575)}
              />
              <p className="hint" style={{ margin: '4px 0 0' }}>Sri Lanka standard design pressure: 575 N/m&sup2;.</p>
            </div>

            <div className="field">
              <label>Poles &amp; Equipment Wind (N/m&sup2;)</label>
              <input
                type="number"
                value={settings.wind_pole_Nm2}
                onChange={(e) => handleFieldChange('wind_pole_Nm2', parseFloat(e.target.value) || 865)}
              />
              <p className="hint" style={{ margin: '4px 0 0' }}>Design wind on concrete pole shaft and transformers: 865 N/m&sup2;.</p>
            </div>

            <div className="field">
              <label>Guy Wire Angle to Pole (&deg;)</label>
              <input
                type="number"
                value={settings.guy_wire_angle_deg}
                onChange={(e) => handleFieldChange('guy_wire_angle_deg', parseFloat(e.target.value) || 30)}
              />
              <p className="hint" style={{ margin: '4px 0 0' }}>Angle between guy wire and pole vertical axis (default 30&deg;).</p>
            </div>
          </div>

          {/* Insulator Tie Threshold Angles */}
          <h3 style={{ fontSize: '13px', color: 'var(--amber)', margin: '22px 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Insulator Fitting Angle Thresholds
          </h3>
          <div className="grid-2">
            <div className="field">
              <label>Top-Tie Maximum Angle (&deg;)</label>
              <input
                type="number"
                value={settings.tie_thresholds.ttie_max}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  tie_thresholds: { ...prev.tie_thresholds, ttie_max: parseFloat(e.target.value) || 10 }
                }))}
              />
              <p className="hint" style={{ margin: '4px 0 0' }}>Route deviation &le; 10&deg; &rarr; Top-Tie (TTIE) is used.</p>
            </div>

            <div className="field">
              <label>Side-Tie Maximum Angle (&deg;)</label>
              <input
                type="number"
                value={settings.tie_thresholds.stie_max}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  tie_thresholds: { ...prev.tie_thresholds, stie_max: parseFloat(e.target.value) || 20 }
                }))}
              />
              <p className="hint" style={{ margin: '4px 0 0' }}>10&deg; &lt; Angle &le; 20&deg; &rarr; Side-Tie (STIE); &gt; 20&deg; &rarr; Double Side-Tie (2STIE).</p>
            </div>
          </div>

          {/* Tension Limits & Stress Criteria */}
          <h3 style={{ fontSize: '13px', color: 'var(--amber)', margin: '22px 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Conductor Stress Criteria (% of Ultimate Tensile Strength)
          </h3>
          <div className="grid-3">
            <div className="field">
              <label>Everyday Stress @ 27 &deg;C (% of UTS)</label>
              <input
                type="number"
                step="0.5"
                value={settings.eds_pct_uts}
                onChange={(e) => handleFieldChange('eds_pct_uts', parseFloat(e.target.value) || 20)}
              />
              <p className="hint" style={{ margin: '4px 0 0' }}>Statutory limit: 20% of UTS (prevents wind fatigue vibration).</p>
            </div>

            <div className="field">
              <label>Max Allowable Stress @ 15 &deg;C + Wind (% of UTS)</label>
              <input
                type="number"
                step="0.5"
                value={settings.max_stress_pct_uts}
                onChange={(e) => handleFieldChange('max_stress_pct_uts', parseFloat(e.target.value) || 40)}
              />
              <p className="hint" style={{ margin: '4px 0 0' }}>Extreme loading limit: 40% of UTS (safety factor &ge; 2.5).</p>
            </div>

            <div className="field">
              <label>Clearance Limits Source</label>
              <select
                value={settings.clearance_source}
                onChange={(e) => handleFieldChange('clearance_source', e.target.value)}
              >
                <option value="regulatory">Regulatory Standard (CEB / LECO)</option>
                <option value="user">User-Defined Minimums</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Guided Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button onClick={() => setActiveTab('settings')}>
          <ArrowLeft size={15} /> Back: Line Structure
        </button>
        <button className="primary" onClick={() => setActiveTab('construction')}>
          Next: Construction Data <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};
