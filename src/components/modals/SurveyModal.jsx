import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Plus, Trash2, Mountain, Building } from 'lucide-react';

export const SurveyModal = () => {
  const { activeModal, setActiveModal, lineRows, updatePole } = useApp();
  if (!activeModal || activeModal.type !== 'survey') return null;

  const { poleIndex } = activeModal;
  const pole = lineRows[poleIndex];
  if (!pole) return null;

  const [surveyPts, setSurveyPts] = useState(() => (pole.survey_points || []).map(p => ({ ...p })));
  const [structures, setStructures] = useState(() => (pole.structure_points || []).map(s => ({ ...s })));

  const handleSave = () => {
    updatePole(poleIndex, {
      survey_points: surveyPts.filter(p => !isNaN(parseFloat(p.x)) && !isNaN(parseFloat(p.h))),
      structure_points: structures.filter(s => !isNaN(parseFloat(s.x)) && !isNaN(parseFloat(s.h)))
    });
    setActiveModal(null);
  };

  const addSurveyPoint = () => {
    setSurveyPts(prev => [...prev, { x: 0, h: 0 }]);
  };

  const removeSurveyPoint = (idx) => {
    setSurveyPts(prev => prev.filter((_, i) => i !== idx));
  };

  const addStructure = () => {
    setStructures(prev => [...prev, { x: 0, h: 0, desc: 'Building / Road' }]);
  };

  const removeStructure = (idx) => {
    setStructures(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="modal-overlay" onClick={() => setActiveModal(null)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <Mountain size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Pole {pole.pole_no} — Terrain Survey &amp; Structure Obstacles
          </h3>
          <button className="modal-close" onClick={() => setActiveModal(null)}>
            <X size={18} />
          </button>
        </div>

        <p className="hint" style={{ marginTop: 0 }}>
          Fore span: <b>{pole.fore_span_m} m</b>. End elevation &Delta;: <b>{pole.elev_delta_m} m</b>.
          Enter intermediate ground survey stations (x from pole, relative elevation h) and any physical obstacles.
        </p>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 8px', color: 'var(--amber)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mountain size={14} /> Intermediate Terrain Profile (Fore Span)
          </h4>
          <div className="table-wrap" style={{ maxHeight: '200px' }}>
            <table>
              <thead>
                <tr>
                  <th>Chainage x (m)</th>
                  <th>Relative Elevation h (m)</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {surveyPts.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ color: 'var(--ink-dim)', padding: '12px' }}>
                      No intermediate points. Straight terrain between pole elevations will be used.
                    </td>
                  </tr>
                ) : (
                  surveyPts.map((pt, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={pole.fore_span_m || 200}
                          value={pt.x}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSurveyPts(prev => prev.map((p, idx) => idx === i ? { ...p, x: val } : p));
                          }}
                          style={{ padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.05"
                          value={pt.h}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSurveyPts(prev => prev.map((p, idx) => idx === i ? { ...p, h: val } : p));
                          }}
                          style={{ padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <button className="danger sm" onClick={() => removeSurveyPoint(i)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="sm" onClick={addSurveyPoint} style={{ marginTop: '8px' }}>
            <Plus size={12} /> Add Survey Station
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 8px', color: 'var(--amber)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={14} /> Structures / Buildings / Trees Along Span
          </h4>
          <div className="table-wrap" style={{ maxHeight: '180px' }}>
            <table>
              <thead>
                <tr>
                  <th>Chainage x (m)</th>
                  <th>Structure Height above ground h (m)</th>
                  <th>Description</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {structures.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ color: 'var(--ink-dim)', padding: '12px' }}>
                      No structures along this span.
                    </td>
                  </tr>
                ) : (
                  structures.map((st, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={pole.fore_span_m || 200}
                          value={st.x}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setStructures(prev => prev.map((s, idx) => idx === i ? { ...s, x: val } : s));
                          }}
                          style={{ padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={st.h}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setStructures(prev => prev.map((s, idx) => idx === i ? { ...s, h: val } : s));
                          }}
                          style={{ padding: '4px', textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={st.desc || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStructures(prev => prev.map((s, idx) => idx === i ? { ...s, desc: val } : s));
                          }}
                          style={{ padding: '4px', textAlign: 'left' }}
                        />
                      </td>
                      <td>
                        <button className="danger sm" onClick={() => removeStructure(i)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="sm" onClick={addStructure} style={{ marginTop: '8px' }}>
            <Plus size={12} /> Add Structure / Obstacle
          </button>
        </div>

        <div className="btn-row" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
          <button type="button" onClick={() => setActiveModal(null)}>Cancel</button>
          <button type="button" className="primary" onClick={handleSave}>Save &amp; Apply</button>
        </div>
      </div>
    </div>
  );
};
