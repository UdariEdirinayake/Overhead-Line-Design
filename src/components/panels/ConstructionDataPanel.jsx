import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';

// Comprehensive human-readable metadata, friendly labels, units, and hints for all 12 construction catalog tables
export const TABLE_METADATA = {
  configs: {
    title: '1. Pole Framing Configurations',
    category: 'Structural Framing',
    description: 'Standard LECO pole framing structures, voltage levels, crossarm attachment heights, and rated capacities.',
    columns: {
      config_no: { label: 'Config #', hint: 'Unique configuration identifier (1–23)' },
      pole_height_m: { label: 'Pole Height', unit: 'm', hint: 'Nominal pole length (e.g. 9m, 11m, 13m)' },
      description: { label: 'Circuit Description', hint: 'Circuit type and framing arrangement' },
      levels_HH: { label: '33 kV Levels', hint: 'Number of 33 kV crossarm levels' },
      levels_H: { label: '11 kV Levels', hint: 'Number of 11 kV crossarm levels' },
      levels_L: { label: 'LV Levels', hint: 'Number of Low Voltage conductor levels' },
      heights_m: { label: 'Attachment Heights', unit: 'm', hint: 'Semicolon-separated conductor attachment heights above ground' },
      n_per_level: { label: 'Conductors / Level', hint: 'Semicolon-separated number of conductors per crossarm level' },
      guy_h_m: { label: 'Guy Attachment Height', unit: 'm', hint: 'Mounting height of intermediate stay wire' },
      tguy_h_m: { label: 'Terminal Guy Height', unit: 'm', hint: 'Mounting height of terminal stay wire' },
      post_class_HH: { label: '33 kV Post Class', hint: 'Post insulator classification for 33 kV' },
      post_class_H: { label: '11 kV Post Class', hint: 'Post insulator classification for 11 kV' },
      capacity_HH_daN: { label: '33 kV Crossarm Rating', unit: 'daN', hint: 'Transverse working load capacity of 33 kV crossarm' },
      capacity_H_daN: { label: '11 kV Crossarm Rating', unit: 'daN', hint: 'Transverse working load capacity of 11 kV crossarm' },
      insulator_HH: { label: '33 kV Insulator', hint: 'Post or Pin insulator type for 33 kV' },
      insulator_H: { label: '11 kV Insulator', hint: 'Post or Pin insulator type for 11 kV' },
      drawing_no: { label: 'Standard Drawing #', hint: 'Official LECO engineering drawing reference' }
    }
  },
  conductors: {
    title: '2. Conductors & Cables Catalog',
    category: 'Conductor Physics',
    description: 'Certified overhead line conductors (AAC, ACSR, ABC, Copper) with mechanical and thermal properties used for sag and tension calculations.',
    columns: {
      code: { label: 'Conductor Code', hint: 'Unique numerical conductor identifier' },
      description: { label: 'Conductor Name & Size', hint: 'Standard description, cross-section area, and construction' },
      diameter_mm: { label: 'Overall Diameter', unit: 'mm', hint: 'Outer diameter for projected wind force calculations' },
      everyday_tension_daN: { label: 'Everyday Tension (EDT)', unit: 'daN', hint: 'Initial ruling installation tension at everyday temperature' },
      lookup_table: { label: 'Span–Tension Table ID', hint: 'Code linking to certified tension-sag chart (e.g. UC-7.90, ABC-70)' },
      'Weight_kg/m': { label: 'Unit Weight', unit: 'kg/m', hint: 'Conductor gravity mass per meter length' },
      'Modulus_of_Elasticity_kg/mm²': { label: 'Modulus of Elasticity (E)', unit: 'kg/mm²', hint: 'Young modulus of elasticity for tension mechanics' },
      'Breaking Load_kg': { label: 'Breaking Load', unit: 'kg', hint: 'Maximum mechanical breaking load' },
      'Thermal_Expansion_Coefficient _/°C': { label: 'Thermal Expansion (α)', unit: '/°C', hint: 'Linear coefficient of thermal expansion' },
      Ultimate_Tensile_Strength_daN: { label: 'UTS Strength', unit: 'daN', hint: 'Ultimate Tensile Strength in decanewtons' },
      notes: { label: 'Standards & Notes', hint: 'Catalog source, ruling span reference, and engineering notes' }
    }
  },
  capacities: {
    title: '3. Pole Classes & Working Capacities',
    category: 'Pole Mechanics',
    description: 'Allowable transverse working loads at pole top, critical Euler buckling limits, self-weights, and dimensions for reinforced concrete poles.',
    columns: {
      pole_height_m: { label: 'Pole Height', unit: 'm', hint: 'Total length of pole' },
      mount_type: { label: 'Support Arrangement', hint: 'unguyed, guyed, or strutted' },
      class_label: { label: 'Class Designation', hint: 'Certified standard class (e.g. 350 U, 500 U, 850 H)' },
      capacity_daN: { label: 'Rated Top Capacity', unit: 'daN', hint: 'Allowable transverse working load applied at 0.3m from pole top' },
      cost_rank: { label: 'Economy Rank', hint: 'Cost prioritization rank (1 = most economical)' },
      avg_breadth_m: { label: 'Average Shaft Width', unit: 'm', hint: 'Average breadth of pole shaft' },
      critical_buckling_kN: { label: 'Critical Buckling Load', unit: 'kN', hint: 'Euler axial buckling limit capacity' },
      below_gl_breadth_m: { label: 'Ground-Line Width', unit: 'm', hint: 'Shaft breadth at ground-line embedment' },
      weight_kg: { label: 'Pole Self-Weight', unit: 'kg', hint: 'Total weight of concrete pole' },
      footprint_mm: { label: 'Base Dimensions', unit: 'mm', hint: 'Butt width x depth footprint' }
    }
  },
  equipment: {
    title: '4. Pole-Mounted Equipment',
    category: 'Plant & Equipment',
    description: 'Distribution transformers, load break switches (LBS), and auto-reclosers (AR) with physical dimensions, weights, and wind areas.',
    columns: {
      equipment: { label: 'Equipment Model', hint: 'Transformer rating or switchgear description' },
      width_m: { label: 'Width', unit: 'm', hint: 'Body width dimension' },
      height_m: { label: 'Height', unit: 'm', hint: 'Body height dimension' },
      depth_m: { label: 'Depth', unit: 'm', hint: 'Body depth dimension' },
      delh_m: { label: 'Center Offset Δh', unit: 'm', hint: 'Vertical center-of-gravity offset from crossarm' },
      weight_kg: { label: 'Equipment Weight', unit: 'kg', hint: 'Total physical weight in kg' },
      area_m2: { label: 'Projected Wind Area', unit: 'm²', hint: 'Frontal area exposed to wind pressure' },
      TFH_11m_Pole: { label: 'Mounting Height (11m)', unit: 'm', hint: 'Mounting height above ground on 11m pole' },
      TFH_13m_Pole: { label: 'Mounting Height (13m)', unit: 'm', hint: 'Mounting height above ground on 13m pole' }
    }
  },
  soil_classes: {
    title: '5. Soil Classes & Geotechnical Properties',
    category: 'Foundation Design',
    description: 'Allowable soil bearing capacity and modulus of subgrade reaction used for pole embedment and foundation overturning checks.',
    columns: {
      class: { label: 'Soil Class (1–5)', hint: 'Soil grade from 1 (Soft clay) to 5 (Hard rock)' },
      description: { label: 'Geotechnical Soil Type', hint: 'Detailed physical soil description' },
      bearing_kNm2: { label: 'Allowable Bearing Pressure', unit: 'kN/m²', hint: 'Permissible foundation soil bearing pressure' },
      'subgrade_kN/m3': { label: 'Subgrade Reaction Modulus', unit: 'kN/m³', hint: 'Lateral soil resistance coefficient' }
    }
  },
  insulators: {
    title: '6. Insulators & Line Hardware',
    category: 'Hardware',
    description: 'Pin and post insulators with operating voltage ratings, nominal attachment heights, and cantilever breaking strengths.',
    columns: {
      description: { label: 'Insulator Type', hint: 'Insulator model and design' },
      voltage_level_kV: { label: 'Voltage Rating', unit: 'kV', hint: '11 kV or 33 kV operating level' },
      nominal_height_m: { label: 'Nominal Height', unit: 'm', hint: 'Height of conductor groove above crossarm' },
      cantilever_strength_kN: { label: 'Cantilever Strength', unit: 'kN', hint: 'Maximum transverse bending strength' },
      notes: { label: 'Application Guidance', hint: 'Usage and mounting details' }
    }
  },
  span_tension_tables: {
    title: '7. Span–Tension Lookup Charts',
    category: 'Span–Tension Data',
    description: 'Certified working tensions and sags tabulated across ruling span lengths at 15°C+Wind, 27°C (stringing), and 65°C (max).',
    columns: {
      table_id: { label: 'Lookup Table ID', hint: 'Table identifier code (e.g. UQ, UP, UC-7.90)' },
      span_m: { label: 'Ruling Span', unit: 'm', hint: 'Span reference length in meters' },
      tension_kN: { label: 'Working Tension (15°C+Wind)', unit: 'kN', hint: 'Design tension used for force and overturning moment' },
      tension_27_kN: { label: 'Stringing Tension (27°C)', unit: 'kN', hint: 'Initial tension during line stringing at 27°C' },
      sag_15_m: { label: 'Sag at 15°C', unit: 'm', hint: 'Conductor sag under wind at 15°C' },
      sag_27_m: { label: 'Sag at 27°C', unit: 'm', hint: 'Ruling stringing sag at ambient 27°C' },
      sag_65_m: { label: 'Max Sag at 65°C', unit: 'm', hint: 'Maximum thermal sag used for ground clearance checks' }
    }
  },
  guy_wires: {
    title: '8. Guy Wires & Stays',
    category: 'Stay Arrangements',
    description: 'Stay wire ratings, safe working tensions, and standard installation lead angles.',
    columns: {
      code: { label: 'Stay Code', hint: 'Identifier (L, M, H, 2H)' },
      description: { label: 'Stay Arrangement', hint: 'Light, Medium, Heavy, Double Heavy Stay' },
      working_load_daN: { label: 'Working Load Limit', unit: 'daN', hint: 'Safe working capacity of stay wire' },
      angle_deg: { label: 'Standard Lead Angle', unit: '°', hint: 'Nominal stay angle to ground (typically 30°)' },
      notes: { label: 'Application Notes', hint: 'Terminal and high angle usage criteria' }
    }
  },
  ground_clearances: {
    title: '9. Ground Clearances',
    category: 'Statutory Safety',
    description: 'Statutory minimum conductor height above ground across roads, terrain, and fields per national safety regulations.',
    columns: {
      voltage_band: { label: 'Voltage Band', hint: '33kV, 11kV, or LV' },
      environment: { label: 'Terrain / Road Environment', hint: 'Across road, along street, farmland, etc.' },
      min_clearance_m: { label: 'Minimum Statutory Clearance', unit: 'm', hint: 'Mandatory minimum ground clearance distance' },
      notes: { label: 'Regulatory Criteria', hint: 'Specific statutory stipulations' }
    }
  },
  structure_clearances: {
    title: '10. Structure & Obstacle Clearances',
    category: 'Statutory Safety',
    description: 'Minimum required clearance distances to buildings, adjacent structures, and trees.',
    columns: {
      voltage_band: { label: 'Voltage Band', hint: '33kV, 11kV, LV Bundle, LV Bare' },
      description: { label: 'Object / Structure Type', hint: 'Buildings, walls, or vegetation' },
      min_clearance_m: { label: 'Minimum Safety Clearance', unit: 'm', hint: 'Required safety buffer distance' },
      notes: { label: 'Application Notes', hint: 'Special construction notes' }
    }
  },
  crossarm_spacings: {
    title: '11. Crossarm Geometry & Spacings',
    category: 'Crossarms',
    description: 'Pin-to-pin dimensions and minimum phase separation distances for standard LECO crossarms.',
    columns: {
      config_no: { label: 'Framing Config #', hint: 'Associated configuration ID' },
      description: { label: 'Crossarm Designation', hint: 'Standard crossarm code (e.g. B0420, P613A)' },
      left_pin_to_middle_m: { label: 'Left to Center Pin', unit: 'm', hint: 'Distance from left pin to center pin' },
      middle_pin_to_right_m: { label: 'Center to Right Pin', unit: 'm', hint: 'Distance from center pin to right pin' },
      minimum_separation_m: { label: 'Min Phase Separation', unit: 'm', hint: 'Minimum conductor separation distance' }
    }
  },
  circuit_clearances: {
    title: '12. Circuit Vertical Clearances',
    category: 'Statutory Safety',
    description: 'Minimum vertical separation required between overlapping circuit voltage levels on joint-use poles.',
    columns: {
      upper_band: { label: 'Upper Circuit Band', hint: 'Higher voltage circuit' },
      lower_band: { label: 'Lower Circuit Band', hint: 'Lower voltage circuit' },
      min_vertical_m: { label: 'Minimum Vertical Clearance', unit: 'm', hint: 'Required vertical separation distance' },
      notes: { label: 'Standard Separation Notes', hint: 'Standard safety notes' }
    }
  }
};

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
  const [activeTableKey, setActiveTableKey] = useState('conductors');
  const [searchFilter, setSearchFilter] = useState('');

  // Local draft state for the active table
  const [tableRows, setTableRows] = useState([]);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

  // Sync with raw CSV whenever activeTableKey or constructionRaw changes
  useEffect(() => {
    const raw = constructionRaw[activeTableKey] || '';
    const parsed = CSV.parse(raw);
    if (parsed.length > 0) {
      setTableHeaders(parsed[0]);
      setTableRows(parsed.slice(1));
    } else {
      setTableHeaders([]);
      setTableRows([]);
    }
    setHasUnsavedChanges(false);
    setSaveSuccessMessage(false);
  }, [activeTableKey, constructionRaw]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passwordInput === '000') {
      setIsConstructionUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const currentMeta = TABLE_METADATA[activeTableKey] || {
    title: activeTableKey,
    description: 'Certified construction standard catalog data table.',
    columns: {}
  };

  // Helper to get user-friendly label, unit, and hint for any column
  const getColMeta = (colKey) => {
    const colDef = currentMeta.columns?.[colKey] || currentMeta.columns?.[colKey.trim()];
    if (colDef) return colDef;
    // Fallback: format rawKey nicely
    const label = colKey
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    return { label, hint: colKey };
  };

  // Filter rows based on search
  const filteredRowsWithIdx = tableRows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .filter(({ row }) =>
      searchFilter.trim() === '' ||
      row.some(cell => String(cell).toLowerCase().includes(searchFilter.toLowerCase()))
    );

  // Cell editing
  const handleCellChange = (rIdx, cIdx, val) => {
    const updated = [...tableRows];
    updated[rIdx] = [...(updated[rIdx] || [])];
    updated[rIdx][cIdx] = val;
    setTableRows(updated);
    setHasUnsavedChanges(true);
    setSaveSuccessMessage(false);
  };

  // Save changes explicitly
  const handleSaveChanges = () => {
    const newCsv = CSV.stringify([tableHeaders, ...tableRows]);
    updateConstructionRaw(activeTableKey, newCsv);
    setHasUnsavedChanges(false);
    setSaveSuccessMessage(true);
    setTimeout(() => setSaveSuccessMessage(false), 3500);
  };

  // Add new row
  const handleAddRow = () => {
    setSearchFilter('');
    const newRow = new Array(tableHeaders.length).fill('');
    const firstCol = (tableHeaders[0] || '').toLowerCase();
    if (firstCol === 'code' || firstCol === 'config_no') {
      const maxId = tableRows.reduce((max, r) => {
        const val = parseInt(r[0], 10);
        return !isNaN(val) && val > max ? val : max;
      }, 0);
      newRow[0] = String(maxId + 1);
    }
    const updated = [...tableRows, newRow];
    setTableRows(updated);
    setHasUnsavedChanges(true);
  };

  // Delete row
  const handleDeleteRow = (rIdx) => {
    const updated = tableRows.filter((_, i) => i !== rIdx);
    setTableRows(updated);
    setHasUnsavedChanges(true);
  };

  // Download CSV
  const handleDownloadCsv = () => {
    const currentCsv = CSV.stringify([tableHeaders, ...tableRows]);
    const blob = new Blob([currentCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTableKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset table to factory defaults
  const handleResetDefaults = () => {
    if (window.confirm(`Are you sure you want to reset "${currentMeta.title}" to certified standard factory defaults? Any custom modifications will be lost.`)) {
      resetConstructionTable(activeTableKey);
      setHasUnsavedChanges(false);
      setSaveSuccessMessage(false);
    }
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
          {/* Header row */}
          <div className="card-header-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--amber)', marginBottom: '4px' }}>
                <Database size={16} />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Certified Construction Database &bull; Editable
                </span>
              </div>
              <h1 style={{ fontSize: '20px', margin: 0, color: 'var(--ink)' }}>
                Construction Standards &amp; Catalog Tables
              </h1>
              <p className="hint" style={{ marginTop: '4px', maxWidth: '850px' }}>
                Inspect and adjust certified engineering tables with human-meaningful column names. Click <strong>Save Changes</strong> to instantly save and use updated values in calculations.
              </p>
            </div>

            <div className="btn-row" style={{ margin: 0 }}>
              <button
                className={`sm ${hasUnsavedChanges ? 'primary' : ''}`}
                onClick={handleSaveChanges}
                style={{
                  background: hasUnsavedChanges ? 'var(--amber)' : undefined,
                  color: hasUnsavedChanges ? '#121008' : undefined,
                  fontWeight: hasUnsavedChanges ? 700 : 500,
                  boxShadow: hasUnsavedChanges ? '0 0 14px var(--amber-glow)' : undefined
                }}
                title="Save changes to browser memory"
              >
                <Save size={13} /> {hasUnsavedChanges ? 'Save Changes *' : 'Save Changes'}
              </button>
              <button className="sm" onClick={() => setIsConstructionUnlocked(false)} title="Lock database">
                <Lock size={13} /> Lock Catalog
              </button>
            </div>
          </div>

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
            {TABLE_KEYS.map((key) => {
              const meta = TABLE_METADATA[key] || { title: key };
              const isActive = activeTableKey === key;
              return (
                <button
                  key={key}
                  className={`sm ${isActive ? 'primary' : ''}`}
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      handleSaveChanges();
                    }
                    setActiveTableKey(key);
                    setSearchFilter('');
                  }}
                  style={{ whiteSpace: 'nowrap', borderRadius: '20px', fontSize: '12px' }}
                >
                  {meta.title}
                </button>
              );
            })}
          </div>

          {/* Active Table Description & Status Banner */}
          <div style={{
            background: 'var(--panel-2)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--line)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--amber)' }}>{currentMeta.title}</strong>
                <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '12px', color: 'var(--ink-muted)' }}>
                  {tableRows.length} total rows
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-dim)', marginTop: '2px' }}>
                {currentMeta.description}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {saveSuccessMessage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ok)', fontSize: '12px', fontWeight: 600 }}>
                  <CheckCircle2 size={15} /> Saved &amp; Active
                </div>
              )}
              {hasUnsavedChanges && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--amber)', fontSize: '12px', fontWeight: 600 }}>
                  <AlertCircle size={15} /> Unsaved changes in table
                </div>
              )}
            </div>
          </div>

          {/* Table Toolbar: Search, Add Row, Save, Download, Reset */}
          <div className="card-header-row" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '420px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--ink-muted)' }} />
                <input
                  type="text"
                  placeholder={`Search in ${currentMeta.title}...`}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div className="btn-row" style={{ margin: 0 }}>
              <button className="sm primary" onClick={handleAddRow} title="Add new row to bottom of table">
                <Plus size={12} /> Add Row
              </button>
              <button
                className="sm"
                onClick={handleSaveChanges}
                style={{
                  background: hasUnsavedChanges ? 'var(--amber)' : undefined,
                  color: hasUnsavedChanges ? '#121008' : undefined,
                  fontWeight: 600
                }}
              >
                <Save size={12} /> Save Changes
              </button>
              <button className="sm" onClick={handleDownloadCsv} title="Download as CSV file">
                <Download size={12} /> Export CSV
              </button>
              <button className="sm danger" onClick={handleResetDefaults} title="Reset to standard factory defaults">
                <RotateCcw size={12} /> Reset to Defaults
              </button>
            </div>
          </div>

          {/* Interactive Data Table with Meaningful Header Names */}
          <div className="table-wrap dt-wrap" style={{ maxHeight: '54vh', marginBottom: '16px', overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  {tableHeaders.map((colKey, idx) => {
                    const meta = getColMeta(colKey);
                    return (
                      <th key={idx} style={{ minWidth: '130px', verticalAlign: 'top' }} title={meta.hint || colKey}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: 'var(--ink)', fontSize: '12px', fontWeight: 700, lineHeight: 1.2 }}>
                            {meta.label}
                            {meta.unit && (
                              <span style={{ color: 'var(--amber)', fontSize: '10.5px', marginLeft: '4px', fontWeight: 600 }}>
                                ({meta.unit})
                              </span>
                            )}
                          </span>
                          <span style={{ color: 'var(--ink-muted)', fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 400 }}>
                            {colKey}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRowsWithIdx.length === 0 ? (
                  <tr>
                    <td colSpan={tableHeaders.length + 2} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-muted)' }}>
                      No matching records found for &quot;{searchFilter}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredRowsWithIdx.map(({ row, originalIndex }) => (
                    <tr key={originalIndex}>
                      <td style={{ color: 'var(--ink-muted)', fontSize: '11px', fontFamily: 'var(--mono)', textAlign: 'center' }}>
                        {originalIndex + 1}
                      </td>
                      {tableHeaders.map((colKey, cIdx) => (
                        <td key={cIdx} style={{ padding: '4px 6px' }}>
                          <input
                            type="text"
                            value={row[cIdx] ?? ''}
                            onChange={(e) => handleCellChange(originalIndex, cIdx, e.target.value)}
                            style={{
                              fontSize: '12px',
                              padding: '5px 8px',
                              width: '100%',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.03)'
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="danger sm"
                          onClick={() => handleDeleteRow(originalIndex)}
                          title="Delete this row"
                          style={{ padding: '4px 6px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Guidance Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--panel-2)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line)',
            fontSize: '11.5px',
            color: 'var(--ink-muted)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={14} style={{ color: 'var(--amber)' }} />
              <span>
                Edit any cell directly. Click <strong>Save Changes</strong> to store your changes locally. All calculations automatically reflect your modifications.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="sm"
                onClick={handleSaveChanges}
                style={{
                  padding: '3px 10px',
                  fontSize: '11.5px',
                  background: hasUnsavedChanges ? 'var(--amber)' : undefined,
                  color: hasUnsavedChanges ? '#121008' : undefined,
                  fontWeight: 600
                }}
              >
                <Save size={11} /> Save Table
              </button>
            </div>
          </div>

          {/* Collapsible Raw CSV Data Drawer */}
          <details className="raw-csv" style={{ marginTop: '14px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--ink-dim)' }}>
              &bull; Advanced: View / Edit Raw CSV Data Format
            </summary>
            <textarea
              value={CSV.stringify([tableHeaders, ...tableRows])}
              onChange={(e) => {
                const parsed = CSV.parse(e.target.value);
                if (parsed.length > 0) {
                  setTableHeaders(parsed[0]);
                  setTableRows(parsed.slice(1));
                  setHasUnsavedChanges(true);
                }
              }}
              placeholder="Paste raw CSV format here..."
              style={{ minHeight: '120px', marginTop: '8px' }}
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
