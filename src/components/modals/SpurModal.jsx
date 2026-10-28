import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Plus, Trash2, GitBranch } from 'lucide-react';

export const SpurModal = () => {
  const { activeModal, setActiveModal, lineRows, updatePole, getParsedData } = useApp();
  if (!activeModal || activeModal.type !== 'spur') return null;

  const { poleIndex } = activeModal;
  const pole = lineRows[poleIndex];
  if (!pole) return null;

  const data = getParsedData();
  const conductors = data.conductors || [];

  const [spurEnabled, setSpurEnabled] = useState(pole.spur_enabled ?? false);
  const [circuits, setCircuits] = useState(() => {
    if (pole.spur_circuits && pole.spur_circuits.length > 0) {
      return pole.spur_circuits.map(c => ({ ...c }));
    }
    // Default initial spur circuit
    return [
      {
        enabled: true,
        voltage: '11kV',
        conductor_code: conductors[0]?.code || '6',
        n_conductors: 3,
        eq_span_m: 30,
        angle_deg: 0,
        tension_factor_pct: 100,
        attach_h_m: 8.0
      }
    ];
  });

  const handleSave = () => {
    updatePole(poleIndex, {
      spur_enabled: spurEnabled,
      spur_circuits: circuits
    });
    setActiveModal(null);
  };

  const addCircuit = () => {
    setCircuits(prev => [
      ...prev,
      {
        enabled: true,
        voltage: 'LV',
        conductor_code: conductors.find(c => c.description?.toLowerCase().includes('aerial') || c.description?.toLowerCase().includes('bundle'))?.code || conductors[0]?.code || '4',
        n_conductors: 1,
        eq_span_m: 30,
        angle_deg: 0,
        tension_factor_pct: 100,
        attach_h_m: 7.2
      }
    ]);
  };

  const removeCircuit = (idx) => {
    setCircuits(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="modal-overlay" onClick={() => setActiveModal(null)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <GitBranch size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Pole {pole.pole_no} — Lateral Spur / Branch Lines (Model W1)
          </h3>
          <button className="modal-close" onClick={() => setActiveModal(null)}>
            <X size={18} />
          </button>
        </div>

        <p className="hint" style={{ marginTop: 0 }}>
          Specify lateral circuits branching off this pole. The model evaluates both line tension and wind loads on the spur, resolved into transverse and longitudinal bending moments on the pole.
        </p>

        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="chk-spur-active"
            checked={spurEnabled}
            onChange={(e) => setSpurEnabled(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="chk-spur-active" style={{ margin: 0, fontSize: '13px', color: 'var(--ink)', cursor: 'pointer' }}>
            Enable Spur / Branch Line Mechanics on Pole {pole.pole_no}
          </label>
        </div>

        {spurEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {circuits.map((circ, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--panel-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={circ.enabled ?? true}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setCircuits(prev => prev.map((c, idx) => idx === i ? { ...c, enabled: val } : c));
                      }}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <strong style={{ fontSize: '12.5px', color: 'var(--amber)' }}>Spur Circuit #{i + 1}</strong>
                  </div>
                  <button className="danger sm" onClick={() => removeCircuit(i)}>
                    <Trash2 size={12} /> Remove
                  </button>
                </div>

                <div className="grid-3">
                  <div className="field">
                    <label>Voltage Band</label>
                    <select
                      value={circ.voltage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCircuits(prev => prev.map((c, idx) => idx === i ? {
                          ...c,
                          voltage: val,
                          n_conductors: val === 'LV' ? 1 : 3,
                          attach_h_m: val === '33kV' ? 9.5 : val === '11kV' ? 8.5 : 7.2
                        } : c));
                      }}
                    >
                      <option value="33kV">33 kV</option>
                      <option value="11kV">11 kV</option>
                      <option value="LV">LV</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Conductor Type</label>
                    <select
                      value={circ.conductor_code}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCircuits(prev => prev.map((c, idx) => idx === i ? { ...c, conductor_code: val } : c));
                      }}
                    >
                      {conductors.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} &mdash; {c.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>No. of Conductors (N)</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={circ.n_conductors}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setCircuits(prev => prev.map((c, idx) => idx === i ? { ...c, n_conductors: val } : c));
                      }}
                    />
                  </div>

                  <div className="field">
                    <label>Spur Eq. Span (m)</label>
                    <input
                      type="number"
                      min="5"
                      max="150"
                      value={circ.eq_span_m}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 30;
                        setCircuits(prev => prev.map((c, idx) => idx === i ? { ...c, eq_span_m: val } : c));
                      }}
                    />
                  </div>

                  <div className="field">
                    <label title="0° = pure transverse; ±90° = pure longitudinal">
                      Take-off Angle &theta; (&deg;) to Transverse
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="-90"
                      max="90"
                      value={circ.angle_deg}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCircuits(prev => prev.map((c, idx) => idx === i ? { ...c, angle_deg: val } : c));
                      }}
                    />
                  </div>

                  <div className="field">
                    <label>Attach Height H (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="20"
                      value={circ.attach_h_m}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 8;
                        setCircuits(prev => prev.map((c, idx) => idx === i ? { ...c, attach_h_m: val } : c));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={addCircuit} style={{ alignSelf: 'flex-start' }}>
              <Plus size={13} /> + Add Another Spur Circuit
            </button>
          </div>
        )}

        <div className="btn-row" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
          <button type="button" onClick={() => setActiveModal(null)}>Cancel</button>
          <button type="button" className="primary" onClick={handleSave}>Save Spur Configuration</button>
        </div>
      </div>
    </div>
  );
};
