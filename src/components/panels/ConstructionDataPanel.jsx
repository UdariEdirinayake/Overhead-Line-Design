import React, { useState } from 'react';
import { useApp, TABLE_KEYS } from '../../context/AppContext';
import { CSV } from '../../engine/csv.js';
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  Download,
  RotateCcw,
  FileCode,
  Search,
  Database,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export const ConstructionDataPanel = () => {
  const {
    constructionRaw,
    updateConstructionRaw,
    resetConstructionTable,
    isConstructionUnlocked,
    setIsConstructionUnlocked,
    setActiveTab
  } = useApp();

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [activeTableKey, setActiveTableKey] = useState('configs');
  const [searchFilter, setSearchFilter] = useState('');

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passwordInput === '000') {
      setIsConstructionUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const tableTitles = {
    configs: '1. Pole Configurations',
    conductors: '2. Conductors',
    span_tension_tables: '3. Span–Tension Tables',
    insulators: '4. Insulators',
    equipment: '5. Pole Equipment & Transformers',
    soil_classes: '6. Soil Classes',
    capacities: '7. Pole Capacities',
    guy_wires: '8. Guy Wires',
    ground_clearances: '9. Ground Clearances',
    structure_clearances: '10. Structure Clearances',
    crossarm_spacings: '11. Crossarm Spacings',
    circuit_clearances: '12. Circuit Clearances'
  };

  const currentCsv = constructionRaw[activeTableKey] || '';
  const parsedRows = CSV.parse(currentCsv);
  const header = parsedRows[0] || [];
  const rows = parsedRows.slice(1);

  // Filter rows based on search
  const filteredRows = searchFilter.trim() === ''
    ? rows
    : rows.filter(r => r.some(cell => String(cell).toLowerCase().includes(searchFilter.toLowerCase())));

  const handleCellChange = (rIdx, cIdx, val) => {
    const updatedRows = [...rows];
    updatedRows[rIdx] = [...(updatedRows[rIdx] || [])];
    updatedRows[rIdx][cIdx] = val;
    const newCsv = CSV.stringify([header, ...updatedRows]);
    updateConstructionRaw(activeTableKey, newCsv);
  };

  const handleAddRow = () => {
    const newRow = new Array(header.length).fill('');
    const newCsv = CSV.stringify([header, ...rows, newRow]);
    updateConstructionRaw(activeTableKey, newCsv);
  };

  const handleDeleteRow = (rIdx) => {
    const updatedRows = rows.filter((_, i) => i !== rIdx);
    const newCsv = CSV.stringify([header, ...updatedRows]);
    updateConstructionRaw(activeTableKey, newCsv);
  };

  const handleDownloadCsv = () => {
    const blob = new Blob([currentCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTableKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBakedHtml = () => {
    const override = {};
    TABLE_KEYS.forEach(k => { override[k] = constructionRaw[k] || ''; });
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LECO Overhead Line Design — Baked Data</title>
</head>
<body>
  <h1>LECO Overhead Line Design Data Export</h1>
  <script>
    window.__POLSEL_BAKED__ = ${JSON.stringify(override, null, 2)};
  </script>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pole-selection-data-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tab-panel">
      {!isConstructionUnlocked ? (
        <div className="card" style={{ maxWidth: '640px', margin: '40px auto', textAlign: 'center', padding: '36px 24px' }}>
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
            <Lock size={26} />
          </div>

          <h2 style={{ fontSize: '18px', margin: '0 0 8px', justifyContent: 'center' }}>
            Construction Standards Database
          </h2>
          <p className="hint" style={{ maxWidth: '480px', margin: '0 auto 20px' }}>
            Protected catalog containing certified pole classes, conductor weights, soil bearing values, and span–tension lookup charts.
          </p>

          <form onSubmit={handleUnlock} style={{ display: 'flex', justifyContent: 'center', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
            <input
              type="password"
              placeholder="Enter password (000)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ textAlign: 'center' }}
            />
            <button type="submit" className="primary">Unlock</button>
          </form>

          <div style={{ marginTop: '14px' }}>
            <button
              className="sm"
              style={{ background: 'transparent', border: 'none', color: 'var(--amber)', textDecoration: 'underline' }}
              onClick={() => { setIsConstructionUnlocked(true); setPasswordError(false); }}
            >
              One-Click Quick Unlock (Testing Mode)
            </button>
          </div>

          {passwordError && (
            <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '10px', fontFamily: 'var(--mono)' }}>
              Incorrect password. Default is 000.
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-header-row">
            <h2>
              <Database size={16} /> Construction Standards &amp; Catalog Tables
            </h2>
            <div className="btn-row" style={{ margin: 0 }}>
              <button className="primary sm" onClick={handleExportBakedHtml} title="Export updated standalone HTML file with current data">
                <FileCode size={13} /> Export Standalone Data HTML
              </button>
              <button className="sm" onClick={() => setIsConstructionUnlocked(false)}>
                <Lock size={13} /> Lock Catalog
              </button>
            </div>
          </div>

          <p className="hint">
            Inspect or adjust certified tables. Changes are cached locally in your browser and automatically incorporated into calculations.
          </p>

          {/* Table category selector pills */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '12px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--line)',
            scrollbarWidth: 'thin'
          }}>
            {TABLE_KEYS.map((key) => (
              <button
                key={key}
                className={`sm ${activeTableKey === key ? 'primary' : ''}`}
                onClick={() => { setActiveTableKey(key); setSearchFilter(''); }}
                style={{ whiteSpace: 'nowrap', borderRadius: '20px' }}
              >
                {tableTitles[key] || key}
              </button>
            ))}
          </div>

          {/* Table Toolbar: Search, Add Row, Download, Reset */}
          <div className="card-header-row" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '380px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--ink-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter table rows..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div className="btn-row" style={{ margin: 0 }}>
              <button className="sm" onClick={handleAddRow}><Plus size={12} /> Add Row</button>
              <button className="sm" onClick={handleDownloadCsv}><Download size={12} /> Download CSV</button>
              <button className="sm danger" onClick={() => resetConstructionTable(activeTableKey)}>
                <RotateCcw size={12} /> Reset to Defaults
              </button>
            </div>
          </div>

          {/* Interactive Data Table */}
          <div className="table-wrap dt-wrap" style={{ maxHeight: '52vh', marginBottom: '16px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  {header.map((col, idx) => (
                    <th key={idx}>{col}</th>
                  ))}
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={header.length + 2} style={{ padding: '20px', color: 'var(--ink-muted)' }}>
                      No matching records found for &quot;{searchFilter}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ color: 'var(--ink-muted)', fontSize: '11px', fontFamily: 'var(--mono)' }}>{rIdx + 1}</td>
                      {header.map((_, cIdx) => (
                        <td key={cIdx}>
                          <input
                            type="text"
                            value={row[cIdx] ?? ''}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          />
                        </td>
                      ))}
                      <td>
                        <button className="danger sm" onClick={() => handleDeleteRow(rIdx)} title="Delete row">
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <details className="raw-csv">
            <summary>&bull; Advanced: View / Edit Raw CSV Data</summary>
            <textarea
              value={currentCsv}
              onChange={(e) => updateConstructionRaw(activeTableKey, e.target.value)}
              placeholder="Paste raw CSV format here..."
            />
          </details>
        </div>
      )}

      {/* Guided Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button onClick={() => setActiveTab('design')}>
          <ArrowLeft size={15} /> Back: Design Parameters
        </button>
        <button className="primary" onClick={() => setActiveTab('line')}>
          Next: Route Input <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};
