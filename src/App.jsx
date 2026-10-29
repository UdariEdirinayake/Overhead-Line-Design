import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { TabsNav } from './components/TabsNav';
import { LineStructurePanel } from './components/panels/LineStructurePanel';
import { DesignParametersPanel } from './components/panels/DesignParametersPanel';
import { ConstructionDataPanel } from './components/panels/ConstructionDataPanel';
import { LineInputPanel } from './components/panels/LineInputPanel';
import { ResultsPanel } from './components/panels/ResultsPanel';
import { CalculationProcessPanel } from './components/panels/CalculationProcessPanel';
import { SurveyModal } from './components/modals/SurveyModal';
import { SpurModal } from './components/modals/SpurModal';

import './styles/theme.css';
import './styles/app.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 24px', maxWidth: '640px', margin: '40px auto', textAlign: 'center' }} className="card">
          <h2 style={{ color: 'var(--amber)', fontSize: '18px', marginBottom: '10px' }}>Notice: Tab encountered an error</h2>
          <p style={{ color: 'var(--ink-dim)', fontSize: '13px', marginBottom: '20px' }}>
            {this.state.error?.message || 'Unexpected issue displaying this panel.'}
          </p>
          <button className="primary" onClick={() => this.setState({ hasError: false })}>
            Reload Tab
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainContent = () => {
  const { activeTab } = useApp();

  return (
    <>
      <Header />
      <TabsNav />

      <main>
        <ErrorBoundary key={activeTab}>
          {activeTab === 'settings' && <LineStructurePanel />}
          {activeTab === 'design' && <DesignParametersPanel />}
          {activeTab === 'construction' && <ConstructionDataPanel />}
          {activeTab === 'line' && <LineInputPanel />}
          {activeTab === 'results' && <ResultsPanel />}
          {activeTab === 'process' && <CalculationProcessPanel />}
        </ErrorBoundary>
      </main>

      <footer className="no-print">
        <div>Overhead Line Design &amp; Pole Selection &bull; Projects Department &bull; Lanka Electricity Company (Private) Limited</div>
        <div style={{ marginTop: '4px', opacity: 0.85 }}>Modernized Modular Web Application Edition &bull; September 2026</div>
        <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.75 }}>Developed &amp; Designed for High-Precision Distribution Engineering &bull; LECO</div>
      </footer>

      {/* Interactive Modals */}
      <SurveyModal />
      <SpurModal />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
