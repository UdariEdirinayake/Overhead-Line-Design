import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { TabsNav } from './components/TabsNav';
import { LineStructurePanel } from './components/panels/LineStructurePanel';
import { DesignParametersPanel } from './components/panels/DesignParametersPanel';
import { ConstructionDataPanel } from './components/panels/ConstructionDataPanel';
import { LineInputPanel } from './components/panels/LineInputPanel';
import { ResultsPanel } from './components/panels/ResultsPanel';
import { SurveyModal } from './components/modals/SurveyModal';
import { SpurModal } from './components/modals/SpurModal';

import './styles/theme.css';
import './styles/app.css';

const MainContent = () => {
  const { activeTab } = useApp();

  return (
    <>
      <Header />
      <TabsNav />

      <main>
        {activeTab === 'settings' && <LineStructurePanel />}
        {activeTab === 'design' && <DesignParametersPanel />}
        {activeTab === 'construction' && <ConstructionDataPanel />}
        {activeTab === 'line' && <LineInputPanel />}
        {activeTab === 'results' && <ResultsPanel />}
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
