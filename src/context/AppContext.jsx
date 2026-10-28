import React, { createContext, useContext, useState, useEffect } from 'react';
import { CSV } from '../engine/csv.js';
import { Calc } from '../engine/calculation.js';
import { DEFAULT_DATA } from '../engine/defaultData.js';

const AppContext = createContext(null);

export const TABLE_KEYS = [
  'configs',
  'conductors',
  'capacities',
  'equipment',
  'soil_classes',
  'insulators',
  'span_tension_tables',
  'guy_wires',
  'ground_clearances',
  'structure_clearances',
  'circuit_clearances',
  'crossarm_spacings'
];

export const AppProvider = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('polsel_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('polsel_theme', theme);
  }, [theme]);

  // Tab state
  const [activeTab, setActiveTab] = useState('settings');

  // Project identification
  const [projectInfo, setProjectInfo] = useState({
    project: '',
    lineName: '',
    jobNo: '',
    designNo: '',
    revNo: '',
    budgetNo: ''
  });

  // Line structure mode: 'legacy' | 'common'
  const [lineStructureMode, setLineStructureMode] = useState('legacy');
  const [commonSections, setCommonSections] = useState([
    { no: 1, start_pole: 1, end_pole: 6, config_no: '2' },
    { no: 2, start_pole: 6, end_pole: 13, config_no: '3' }
  ]);

  // Construction data (raw CSV strings)
  const [constructionRaw, setConstructionRaw] = useState(() => {
    const raw = {};
    TABLE_KEYS.forEach(k => {
      const saved = localStorage.getItem('polsel_csv_' + k);
      raw[k] = saved || DEFAULT_DATA[k] || '';
    });
    return raw;
  });

  // Parsed construction data objects
  const getParsedData = () => {
    const equipment = CSV.parseObjects(constructionRaw.equipment || '');
    return {
      configs: CSV.parseObjects(constructionRaw.configs || ''),
      conductors: CSV.parseObjects(constructionRaw.conductors || ''),
      capacities: CSV.parseObjects(constructionRaw.capacities || ''),
      soil_classes: CSV.parseObjects(constructionRaw.soil_classes || ''),
      equipment: equipment,
      transformers: equipment,
      span_tension_tables: CSV.parseObjects(constructionRaw.span_tension_tables || ''),
      guy_wires: CSV.parseObjects(constructionRaw.guy_wires || ''),
      insulators: CSV.parseObjects(constructionRaw.insulators || ''),
      ground_clearances: CSV.parseObjects(constructionRaw.ground_clearances || ''),
      structure_clearances: CSV.parseObjects(constructionRaw.structure_clearances || ''),
      circuit_clearances: CSV.parseObjects(constructionRaw.circuit_clearances || ''),
      crossarm_spacings: CSV.parseObjects(constructionRaw.crossarm_spacings || '')
    };
  };

  // Design & selection settings
  const [settings, setSettings] = useState({
    config_no: '2',
    conductors_by_band: {
      HH: [],
      H: ['6'],
      L: ['4']
    },
    conductor_HH: '',
    conductor_H: '6',
    conductor_LV: '4',
    insulator_HH_desc: '33kV Post',
    insulator_H_desc: '11kV Pin',
    crossarms: { HH: [], H: [] },
    wind_pressure_Nm2: 575,
    wind_pole_Nm2: 865,
    guy_angle_limit_deg: 0,
    guy_wire_angle_deg: 30,
    calc_method: 'leco_standard',
    cb_t_sag: 65,
    cb_t_wind: 15,
    cb_creep_33: 0.3,
    cb_creep_11: 0.3,
    cb_creep_lvabc: 0.4,
    cb_creep_lvbare: 0.2,
    tie_thresholds: { ttie_max: 10, stie_max: 20 },
    eds_pct_uts: 20,
    max_stress_pct_uts: 40,
    clearance_source: 'regulatory',
    user_gc: {
      '33kV': 6.1,
      '11kV': 5.5,
      'LV': 5.5
    },
    user_cc: {
      '33kV|11kV': 1.2,
      '11kV|LV': 1.0,
      '33kV|LV': 1.5
    },
    tension_factors: {}
  });

  // Line rows state (default with sampleLine)
  const [lineRows, setLineRows] = useState(() => {
    return CSV.parseObjects(DEFAULT_DATA.sampleLine || '').map(r => ({
      section: r.section || '1',
      pole_no: parseFloat(r.pole_no) || 1,
      aft_span_m: parseFloat(r.aft_span_m || 0),
      fore_span_m: parseFloat(r.fore_span_m || 0),
      elev_delta_m: parseFloat(r.elev_delta_m || 0),
      angle_deg: parseFloat(r.angle_deg || 0),
      soil_class: r.soil_class || '4',
      equipment: r.equipment || '',
      span_environment: r.span_environment || 'along or across any road or street',
      guy_pole_angle_deg: 30,
      guy_theta_enabled: false,
      guy_theta_deg: 0,
      survey_points: [],
      structure_points: [],
      spur_enabled: false,
      spur_circuits: [],
      crossarms: { HH: [], H: [] }
    }));
  });

  // Circuit section configuration (common mode)
  const [circuitSectionCI, setCircuitSectionCI] = useState({});

  // Calculation results
  const [results, setResults] = useState(null);
  const [calcError, setCalcError] = useState(null);

  // Security locks
  const [isConstructionUnlocked, setIsConstructionUnlocked] = useState(false);
  const [isDesignUnlocked, setIsDesignUnlocked] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // { type: 'survey' | 'spur', poleIndex: number }

  // Update construction data
  const updateConstructionRaw = (key, csvValue) => {
    setConstructionRaw(prev => {
      const next = { ...prev, [key]: csvValue };
      localStorage.setItem('polsel_csv_' + key, csvValue);
      return next;
    });
  };

  const resetConstructionTable = (key) => {
    const orig = DEFAULT_DATA[key] || '';
    updateConstructionRaw(key, orig);
  };

  // Add pole row
  const addPole = () => {
    setLineRows(prev => {
      const last = prev[prev.length - 1];
      const nextNo = last ? (last.pole_no + 1) : 1;
      const nextSection = last ? last.section : '1';
      const aft = last ? (last.fore_span_m || 0) : 0;
      return [
        ...prev,
        {
          section: nextSection,
          pole_no: nextNo,
          aft_span_m: aft,
          fore_span_m: 0,
          elev_delta_m: 0,
          angle_deg: 0,
          soil_class: last ? last.soil_class : '4',
          equipment: '',
          span_environment: last ? last.span_environment : 'along or across any road or street',
          guy_pole_angle_deg: 30,
          guy_theta_enabled: false,
          guy_theta_deg: 0,
          survey_points: [],
          structure_points: [],
          spur_enabled: false,
          spur_circuits: [],
          crossarms: { HH: [], H: [] }
        }
      ];
    });
  };

  // Add new section
  const newSection = () => {
    setLineRows(prev => {
      const last = prev[prev.length - 1];
      const nextNo = last ? (last.pole_no + 1) : 1;
      const nextSec = last ? (parseInt(last.section) + 1).toString() : '1';
      return [
        ...prev,
        {
          section: nextSec,
          pole_no: nextNo,
          aft_span_m: 0,
          fore_span_m: 30,
          elev_delta_m: 0,
          angle_deg: 0,
          soil_class: last ? last.soil_class : '4',
          equipment: '',
          span_environment: 'along or across any road or street',
          guy_pole_angle_deg: 30,
          guy_theta_enabled: false,
          guy_theta_deg: 0,
          survey_points: [],
          structure_points: [],
          spur_enabled: false,
          spur_circuits: [],
          crossarms: { HH: [], H: [] }
        }
      ];
    });
  };

  const updatePole = (index, updates) => {
    setLineRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      // Keep aft span in sync with preceding pole fore span if consecutive
      if (updates.fore_span_m !== undefined && index < copy.length - 1) {
        copy[index + 1] = { ...copy[index + 1], aft_span_m: parseFloat(updates.fore_span_m) || 0 };
      }
      return copy;
    });
  };

  const deletePole = (index) => {
    setLineRows(prev => prev.filter((_, i) => i !== index));
  };

  const clearLine = () => {
    setLineRows([]);
    setResults(null);
  };

  const loadSampleLine = () => {
    const parsed = CSV.parseObjects(DEFAULT_DATA.sampleLine || '').map(r => ({
      section: r.section || '1',
      pole_no: parseFloat(r.pole_no) || 1,
      aft_span_m: parseFloat(r.aft_span_m || 0),
      fore_span_m: parseFloat(r.fore_span_m || 0),
      elev_delta_m: parseFloat(r.elev_delta_m || 0),
      angle_deg: parseFloat(r.angle_deg || 0),
      soil_class: r.soil_class || '4',
      equipment: r.equipment || '',
      span_environment: r.span_environment || 'along or across any road or street',
      guy_pole_angle_deg: 30,
      guy_theta_enabled: false,
      guy_theta_deg: 0,
      survey_points: [],
      structure_points: [],
      spur_enabled: false,
      spur_circuits: [],
      crossarms: { HH: [], H: [] }
    }));
    setLineRows(parsed);
  };

  // Run calculation engine
  const runCalculation = () => {
    setCalcError(null);
    try {
      if (!lineRows.length) {
        setCalcError('Please add poles in Line Input first (or click "Load sample line").');
        return;
      }
      const data = getParsedData();

      // Check span tension tables
      const sel = settings.conductors_by_band || {};
      const codes = [].concat(sel.HH || [], sel.H || [], sel.L || []).filter(Boolean);
      const maxByCode = {};
      codes.forEach(code => {
        const cond = (data.conductors || []).find(c => String(c.code) === String(code));
        if (cond) {
          const tableId = (cond.lookup_table || '').trim();
          (data.span_tension_tables || []).filter(r => String(r.table_id) === tableId).forEach(r => {
            const s = parseFloat(r.span_m);
            if (Number.isFinite(s) && (maxByCode[code] == null || s > maxByCode[code])) maxByCode[code] = s;
          });
        }
      });
      const overallMax = Object.values(maxByCode).length ? Math.min(...Object.values(maxByCode)) : null;
      if (overallMax != null) {
        const offenders = lineRows.filter(r => parseFloat(r.fore_span_m) > overallMax + 1e-6);
        if (offenders.length) {
          setCalcError(`Fore span exceeds max span in selected conductor span-tension table (${overallMax} m). Offending poles: ${offenders.map(r => r.pole_no).join(', ')}.`);
          return;
        }
      }

      const appState = {
        lineStructureMode,
        commonSections,
        circuitSectionCI
      };

      const computed = Calc.computeLine(lineRows, settings, data, appState);
      setResults(computed);
      setActiveTab('results');
    } catch (err) {
      console.error(err);
      setCalcError('Calculation error: ' + err.message);
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        activeTab,
        setActiveTab,
        projectInfo,
        setProjectInfo,
        lineStructureMode,
        setLineStructureMode,
        commonSections,
        setCommonSections,
        constructionRaw,
        updateConstructionRaw,
        resetConstructionTable,
        getParsedData,
        settings,
        setSettings,
        lineRows,
        setLineRows,
        addPole,
        newSection,
        updatePole,
        deletePole,
        clearLine,
        loadSampleLine,
        circuitSectionCI,
        setCircuitSectionCI,
        results,
        calcError,
        runCalculation,
        isConstructionUnlocked,
        setIsConstructionUnlocked,
        isDesignUnlocked,
        setIsDesignUnlocked,
        activeModal,
        setActiveModal
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
