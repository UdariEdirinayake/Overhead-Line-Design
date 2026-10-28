import React from 'react';
import { useApp } from '../context/AppContext';
import { Zap, Palette, Printer, Play, CheckCircle2, Clock } from 'lucide-react';

export const Header = () => {
  const { theme, setTheme, runCalculation, activeTab, lineRows, results } = useApp();

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="logo-badge">
          <Zap size={16} fill="#ffffff" />
          <span>LECO</span>
        </div>
        <div className="app-title">
          <div>
            <h1>Overhead Line Design &amp; Pole Selection</h1>
            <div className="sub">Lanka Electricity Company (Private) Limited &bull; Projects Department</div>
          </div>
        </div>

        <div className="header-status-pill no-print">
          <span className="header-status-dot"></span>
          <span>{lineRows.length} Poles configured</span>
          {results && <span style={{ color: 'var(--ok)', marginLeft: '4px' }}>&bull; Calculated</span>}
        </div>
      </div>

      <div className="header-actions no-print">
        <div className="theme-picker" title="Switch visual color theme">
          <Palette size={14} />
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="dark">Dark Theme</option>
            <option value="light">Light Theme</option>
            <option value="ocean">Ocean Blue</option>
            <option value="slate">Slate Modern</option>
            <option value="midnight">Midnight Purple</option>
          </select>
        </div>

        <button
          className="primary"
          onClick={runCalculation}
          title="Run mechanical calculations, pole selection & clearances"
        >
          <Play size={14} /> Calculate
        </button>

        {activeTab === 'results' && (
          <button
            onClick={() => window.print()}
            title="Print formal A4 engineering report"
          >
            <Printer size={14} /> Print Report
          </button>
        )}
      </div>
    </header>
  );
};
