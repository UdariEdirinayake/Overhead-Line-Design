import React from 'react';
import { useApp } from '../context/AppContext';
import { Layers, Sliders, Database, TableProperties, BarChart3, Check } from 'lucide-react';

export const TabsNav = () => {
  const { activeTab, setActiveTab, results, lineRows } = useApp();

  const steps = [
    {
      id: 'settings',
      num: 1,
      title: 'Line Structure',
      subtitle: 'Config & Conductors',
      icon: Layers,
      completed: true
    },
    {
      id: 'design',
      num: 2,
      title: 'Design Parameters',
      subtitle: 'Wind & Clearances',
      icon: Sliders,
      completed: true
    },
    {
      id: 'construction',
      num: 3,
      title: 'Construction Data',
      subtitle: 'Standard Tables',
      icon: Database,
      completed: true
    },
    {
      id: 'line',
      num: 4,
      title: 'Route Input',
      subtitle: `${lineRows.length} Poles defined`,
      icon: TableProperties,
      completed: lineRows.length > 0
    },
    {
      id: 'results',
      num: 5,
      title: 'Results & Reports',
      subtitle: results ? 'Ready & Verified' : 'Awaiting Calculation',
      icon: BarChart3,
      completed: !!results
    }
  ];

  return (
    <nav className="stepper-nav no-print">
      {steps.map((step) => {
        const Icon = step.icon;
        const isActive = activeTab === step.id;

        return (
          <button
            key={step.id}
            className={`step-item ${isActive ? 'active' : ''} ${step.completed && !isActive ? 'completed' : ''}`}
            onClick={() => setActiveTab(step.id)}
          >
            <div className="step-circle">
              {step.completed && !isActive ? (
                <Check size={12} strokeWidth={3} />
              ) : (
                step.num
              )}
            </div>

            <div className="step-text">
              <span className="step-title">{step.title}</span>
              <span className="step-subtitle">{step.subtitle}</span>
            </div>
          </button>
        );
      })}
    </nav>
  );
};
