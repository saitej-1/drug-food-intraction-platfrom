import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Info, ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';
import { FOODS, DRUGS, FOOD_FEATURES, DRUG_FEATURES } from '../data/interactions';
import ThreeCanvas from './ThreeCanvas';
import { parseSmiles, layout3D, extractFeaturesFromSmiles } from '../utils/smiles';

const FEATURE_DESCRIPTIONS = {
  // Food Features
  cyp3a4_inhibitor: { label: "CYP3A4 Inhibitor", desc: "Blocks gut/liver breakdown pathways, causing drug accumulation (e.g. Grapefruit)." },
  vitamin_k_rich: { label: "Vitamin K Rich", desc: "Promotes blood clotting factors, directly opposing anticoagulants (e.g. Spinach)." },
  calcium_rich: { label: "Calcium Rich", desc: "High calcium cations bind/chelate specific drugs in stomach, preventing absorption (e.g. Milk)." },
  tyramine_rich: { label: "Tyramine Content", desc: "Builds up and spikes blood pressure if MAO enzymes are inhibited (e.g. Aged cheese)." },
  potassium_rich: { label: "Potassium Rich", desc: "High potassium concentrations, affecting cardiac conduction (e.g. Bananas)." },
  alcohol_present: { label: "Contains Ethanol", desc: "Acts as a central depressant and metabolic competitor in liver enzymes." },
  fiber_rich: { label: "High Soluble Fiber", desc: "Soluble fibers mechanically trap drug compounds in gut (e.g. Oats)." },
  oatp_inhibitor: { label: "OATP Transporter Inhibitor", desc: "Inhibits organic anion transporting polypeptides in intestinal walls." },
  glycyrrhizin: { label: "Contains Glycyrrhizin", desc: "Triggers potassium excretion and sodium retention (e.g. Black licorice)." },
  cyp1a2_inducer: { label: "CYP1A2 Inducer", desc: "Accelerates hepatic clearance of specific substrates (e.g. Broccoli)." },
  ginkgolide: { label: "Contains Ginkgolides / Garlic", desc: "Possesses antiplatelet properties, extending coagulation times." },
  hypoglycemic_herb: { label: "Hypoglycemic Active", desc: "Enhances glucose-lowering pathways additively (e.g. Ginseng)." },
  cyp3a4_inducer: { label: "CYP3A4 Inducer", desc: "Strongly induces drug clearance pathways (e.g. St. John's Wort)." },
  cyp2c9_inhibitor: { label: "CYP2C9 Inhibitor", desc: "Slows clearance of warfarin, raising systemic bleeding risk (e.g. Cranberries)." },
  methylxanthines: { label: "Contains Methylxanthines", desc: "Caffeine/theobromine molecules that relax smooth muscles (e.g. Chocolate)." },

  // Drug Features
  statin: { label: "HMG-CoA Reductase Inhibitor", desc: "Cholesterol-lowering statin base; metabolized heavily by CYP3A4." },
  anticoagulant: { label: "Vitamin K Antagonist", desc: "Warfarin class anticoagulant; highly sensitive to external Vitamin K." },
  antibiotic: { label: "Fluoroquinolone Antibiotic", desc: "Destroys bacterial walls; chelates with polyvalent calcium cations." },
  maoi: { label: "MAOI Antidepressant", desc: "Inhibits Monoamine Oxidase, letting tyramine build up in circulation." },
  ace_inhibitor: { label: "ACE Inhibitor", desc: "Antihypertensive lisinopril base; causes potassium retention in kidneys." },
  acetaminophen: { label: "Analgesic (Acetaminophen)", desc: "Metabolized to hepatotoxic NAPQI; cleared by liver glutathione." },
  cardiac_glycoside: { label: "Cardiac Glycoside", desc: "Digoxin base; narrow therapeutic index, binds to soluble fibers." },
  calcium_channel: { label: "Calcium Channel Blocker", desc: "Reduces blood pressure; metabolized heavily by intestinal CYP3A4." },
  oatp_substrate: { label: "OATP Transporter Substrate", desc: "Requires OATP transporters in intestinal wall to cross into portal blood." },
  cyp1a2_substrate: { label: "CYP1A2 Substrate", desc: "Theophylline asthma base; cleared systemically by CYP1A2 pathways." },
  diuretic_k_sparing: { label: "Potassium-Sparing Diuretic", desc: "Excretes sodium but retains potassium, warning for hyperkalemia." },
  nsaid_antiplatelet: { label: "NSAID / Antiplatelet", desc: "Reduces inflammatory prostaglandins and slows clotting aggregation." },
  antidiabetic: { label: "Antidiabetic Biguanide", desc: "Metformin base; suppresses liver glucose outputs." },
  ssri: { label: "SSRI Antidepressant", desc: "Inhibits serotonin reuptake; warnings for cumulative Serotonin Syndrome." },
  contraceptive: { label: "Hormonal Oral Contraceptive", desc: "Estrogen base; highly sensitive to clearance induction speeds." }
};

// 3D Atomic Structure Compiler based on physiological feature flags
function generateCustomMolecule(flags, type) {
  const atoms = [];
  const bonds = [];
  let id = 0;

  // 1. Core Carbon ring (6 Carbons in a ring at z = 0)
  const ringCarbons = 6;
  const radius = 1.0;
  for (let i = 0; i < ringCarbons; i++) {
    const angle = (i * Math.PI * 2) / ringCarbons;
    atoms.push({
      id: id++,
      element: 'C',
      pos: [Math.cos(angle) * radius, Math.sin(angle) * radius, 0]
    });
  }
  // Alternate single and double bonds
  for (let i = 0; i < ringCarbons; i++) {
    bonds.push({
      source: i,
      target: (i + 1) % ringCarbons,
      value: i % 2 === 0 ? 2 : 1
    });
  }

  // 2. Base Hydrogen caps on C ring
  for (let i = 0; i < ringCarbons; i++) {
    const angle = (i * Math.PI * 2) / ringCarbons;
    if (i % 2 !== 0) {
      atoms.push({
        id: id++,
        element: 'H',
        pos: [Math.cos(angle) * 1.6, Math.sin(angle) * 1.6, 0]
      });
      bonds.push({
        source: i,
        target: id - 1,
        value: 1
      });
    }
  }

  const addBranch = (sourceCarbonIdx, element, distance, value = 1, zOffset = 0) => {
    const angle = (sourceCarbonIdx * Math.PI * 2) / ringCarbons;
    atoms.push({
      id: id++,
      element: element,
      pos: [
        Math.cos(angle) * (radius + distance),
        Math.sin(angle) * (radius + distance),
        zOffset
      ]
    });
    bonds.push({
      source: sourceCarbonIdx,
      target: id - 1,
      value: value
    });
    return id - 1;
  };

  // 3. Add chemical groups depending on active checkboxes
  if (type === 'food') {
    if (flags.cyp3a4_inhibitor) {
      addBranch(0, 'O', 0.6, 1, 0.4);
    }
    if (flags.vitamin_k_rich) {
      const c1 = addBranch(2, 'C', 0.6, 1);
      atoms.push({ id: id++, element: 'C', pos: [atoms[c1].pos[0] + 0.5, atoms[c1].pos[1] + 0.5, 0.4] });
      bonds.push({ source: c1, target: id - 1, value: 1 });
    }
    if (flags.calcium_rich) {
      atoms.push({ id: id++, element: 'Ca', pos: [0, 0, 0.9] });
    }
    if (flags.tyramine_rich) {
      const n1 = addBranch(4, 'N', 0.6, 1);
      atoms.push({ id: id++, element: 'H', pos: [atoms[n1].pos[0] - 0.4, atoms[n1].pos[1] - 0.4, 0.4] });
      bonds.push({ source: n1, target: id - 1, value: 1 });
    }
    if (flags.potassium_rich) {
      atoms.push({ id: id++, element: 'K', pos: [0, 0, -0.9] });
    }
    if (flags.alcohol_present) {
      const o1 = addBranch(0, 'O', 0.5, 1, -0.3);
      atoms.push({ id: id++, element: 'H', pos: [atoms[o1].pos[0] + 0.3, atoms[o1].pos[1] + 0.3, -0.6] });
      bonds.push({ source: o1, target: id - 1, value: 1 });
    }
    if (flags.fiber_rich) {
      addBranch(2, 'O', 0.6, 1, -0.5);
    }
    if (flags.oatp_inhibitor) {
      addBranch(4, 'O', 0.6, 2);
    }
    if (flags.glycyrrhizin) {
      const c1 = addBranch(0, 'C', 0.6, 1);
      atoms.push({ id: id++, element: 'O', pos: [atoms[c1].pos[0] + 0.4, atoms[c1].pos[1] - 0.4, 0.2] });
      bonds.push({ source: c1, target: id - 1, value: 2 });
    }
    if (flags.cyp1a2_inducer) {
      addBranch(2, 'N', 0.5, 1, 0.3);
    }
    if (flags.ginkgolide) {
      addBranch(4, 'O', 0.5, 1, 0.4);
    }
    if (flags.hypoglycemic_herb) {
      const c1 = addBranch(0, 'C', 0.5, 1);
      addBranch(c1, 'O', 0.5, 1);
    }
    if (flags.cyp3a4_inducer) {
      addBranch(2, 'O', 0.5, 1);
    }
    if (flags.cyp2c9_inhibitor) {
      addBranch(4, 'O', 0.5, 1);
    }
    if (flags.methylxanthines) {
      addBranch(0, 'N', 0.5, 1);
    }
  } else {
    // DRUG FEATURES
    if (flags.statin) {
      addBranch(0, 'F', 0.6, 1, 0.4);
    }
    if (flags.anticoagulant) {
      addBranch(2, 'O', 0.6, 2);
    }
    if (flags.antibiotic) {
      addBranch(4, 'N', 0.6, 1, -0.4);
    }
    if (flags.maoi) {
      const n1 = addBranch(0, 'N', 0.5, 1);
      atoms.push({ id: id++, element: 'N', pos: [atoms[n1].pos[0] + 0.4, atoms[n1].pos[1] + 0.4, 0.3] });
      bonds.push({ source: n1, target: id - 1, value: 1 });
    }
    if (flags.ace_inhibitor) {
      const c1 = addBranch(2, 'C', 0.5, 1);
      atoms.push({ id: id++, element: 'O', pos: [atoms[c1].pos[0] + 0.3, atoms[c1].pos[1] + 0.3, 0.2] });
      bonds.push({ source: c1, target: id - 1, value: 2 });
    }
    if (flags.acetaminophen) {
      const n1 = addBranch(4, 'N', 0.5, 1);
      const c1 = atoms.push({ id: id++, element: 'C', pos: [atoms[n1].pos[0] - 0.4, atoms[n1].pos[1] - 0.4, 0.2] }) - 1;
      bonds.push({ source: n1, target: c1, value: 1 });
      atoms.push({ id: id++, element: 'O', pos: [atoms[c1].pos[0] - 0.2, atoms[c1].pos[1] - 0.5, 0.4] });
      bonds.push({ source: c1, target: id - 1, value: 2 });
    }
    if (flags.cardiac_glycoside) {
      addBranch(0, 'O', 0.5, 1);
    }
    if (flags.calcium_channel) {
      addBranch(2, 'Cl', 0.6, 1, -0.4);
    }
    if (flags.oatp_substrate) {
      addBranch(4, 'O', 0.5, 1);
    }
    if (flags.cyp1a2_substrate) {
      addBranch(0, 'N', 0.5, 1);
    }
    if (flags.diuretic_k_sparing) {
      addBranch(2, 'S', 0.5, 1);
    }
    if (flags.nsaid_antiplatelet) {
      const o1 = addBranch(4, 'O', 0.5, 1);
      const c1 = atoms.push({ id: id++, element: 'C', pos: [atoms[o1].pos[0] - 0.3, atoms[o1].pos[1] - 0.3, 0.2] }) - 1;
      bonds.push({ source: o1, target: c1, value: 1 });
    }
    if (flags.antidiabetic) {
      addBranch(0, 'N', 0.5, 1);
    }
    if (flags.ssri) {
      addBranch(2, 'Cl', 0.6, 1);
    }
    if (flags.contraceptive) {
      addBranch(4, 'O', 0.5, 1);
    }
  }

  // Fallback H
  if (atoms.length === 6) {
    for (let i = 0; i < ringCarbons; i += 2) {
      const angle = (i * Math.PI * 2) / ringCarbons;
      atoms.push({
        id: id++,
        element: 'H',
        pos: [Math.cos(angle) * 1.6, Math.sin(angle) * 1.6, 0]
      });
      bonds.push({
        source: i,
        target: id - 1,
        value: 1
      });
    }
  }

  return { atoms, bonds };
}

export default function MolecularSandbox({ network, isModelTrained }) {
  const [compoundType, setCompoundType] = useState('food'); // 'food' or 'drug'
  
  // Track input mode: 'checkbox' or 'smiles'
  const [inputMode, setInputMode] = useState('checkbox');
  const [smilesInput, setSmilesInput] = useState('CCO');
  const [smilesError, setSmilesError] = useState('');

  // Track features selected for custom molecule
  const [selectedFeatures, setSelectedFeatures] = useState({});
  const [selectedPairId, setSelectedPairId] = useState('');
  const [predictionResult, setPredictionResult] = useState(null);

  // Set default pairing and default SMILES when type changes
  useEffect(() => {
    setSelectedFeatures({});
    if (compoundType === 'food') {
      setSelectedPairId(DRUGS[0].id);
      setSmilesInput('CCO'); // Ethanol default
    } else {
      setSelectedPairId(FOODS[0].id);
      setSmilesInput('CC(=O)NC1=CC=C(O)C=C1'); // Acetaminophen default
    }
    setPredictionResult(null);
  }, [compoundType]);

  // Parse SMILES string and generate coordinates via 3D Spring Layout
  const smilesMoleculeData = useMemo(() => {
    if (inputMode !== 'smiles') return null;
    if (!smilesInput.trim()) {
      setSmilesError('Enter a SMILES string to parse');
      return { atoms: [], bonds: [] };
    }
    try {
      const parsed = parseSmiles(smilesInput);
      if (parsed.atoms.length === 0) {
        setSmilesError('No valid atoms parsed from string');
        return { atoms: [], bonds: [] };
      }
      setSmilesError('');
      return layout3D(parsed);
    } catch (err) {
      setSmilesError('Failed to parse SMILES: ' + err.message);
      return { atoms: [], bonds: [] };
    }
  }, [smilesInput, inputMode]);

  // Dynamic chemical coordinate compilation
  const dynamicMoleculeData = useMemo(() => {
    if (inputMode === 'smiles') {
      return smilesMoleculeData;
    }
    return generateCustomMolecule(selectedFeatures, compoundType);
  }, [selectedFeatures, compoundType, inputMode, smilesMoleculeData]);

  const handleCheckboxChange = (featureKey) => {
    setSelectedFeatures(prev => ({
      ...prev,
      [featureKey]: !prev[featureKey]
    }));
  };

  const handleAnalyze = useCallback(() => {
    if (!network) return;

    let inputVector;

    if (inputMode === 'smiles') {
      const smilesVec = extractFeaturesFromSmiles(smilesInput, compoundType);

      // Build paired vector
      let pairVec;
      if (compoundType === 'food') {
        const pairedDrug = DRUGS.find(d => d.id === selectedPairId);
        pairVec = pairedDrug ? pairedDrug.features : new Array(DRUG_FEATURES.length).fill(0);
      } else {
        const pairedFood = FOODS.find(f => f.id === selectedPairId);
        pairVec = pairedFood ? pairedFood.features : new Array(FOOD_FEATURES.length).fill(0);
      }

      inputVector = compoundType === 'food' 
        ? [...smilesVec, ...pairVec] 
        : [...pairVec, ...smilesVec];
    } else {
      // Build custom vector from checkboxes
      const customFeaturesLength = compoundType === 'food' ? FOOD_FEATURES.length : DRUG_FEATURES.length;
      const customVec = new Array(customFeaturesLength).fill(0);
      
      const activeFeaturesList = compoundType === 'food' ? FOOD_FEATURES : DRUG_FEATURES;
      activeFeaturesList.forEach((feat, idx) => {
        if (selectedFeatures[feat]) {
          customVec[idx] = 1;
        }
      });

      // Build paired vector
      let pairVec;
      if (compoundType === 'food') {
        const pairedDrug = DRUGS.find(d => d.id === selectedPairId);
        pairVec = pairedDrug ? pairedDrug.features : new Array(DRUG_FEATURES.length).fill(0);
      } else {
        const pairedFood = FOODS.find(f => f.id === selectedPairId);
        pairVec = pairedFood ? pairedFood.features : new Array(FOOD_FEATURES.length).fill(0);
      }

      inputVector = compoundType === 'food' 
        ? [...customVec, ...pairVec] 
        : [...pairVec, ...customVec];
    }

    // Run Neural Network forward pass
    const state = network.forward(inputVector);
    const probabilities = state.outputActivations;

    // Find predicted class
    let maxIdx = 0;
    let maxProb = -1;
    probabilities.forEach((p, idx) => {
      if (p > maxProb) {
        maxProb = p;
        maxIdx = idx;
      }
    });

    const classes = ['safe', 'moderate', 'severe'];
    setPredictionResult({
      predictedClass: classes[maxIdx],
      probabilities,
      inputVector
    });
  }, [network, compoundType, selectedFeatures, selectedPairId, inputMode, smilesInput]);

  // Re-run analysis automatically when features or pairings change
  useEffect(() => {
    handleAnalyze();
  }, [handleAnalyze]);

  // Extract matched features for display in SMILES mode
  const matchedFeaturesInfo = useMemo(() => {
    if (inputMode !== 'smiles') return null;
    const smilesVec = extractFeaturesFromSmiles(smilesInput, compoundType);
    const activeFeaturesList = compoundType === 'food' ? FOOD_FEATURES : DRUG_FEATURES;
    const matched = [];
    activeFeaturesList.forEach((feat, idx) => {
      if (smilesVec[idx] === 1) {
        matched.push(FEATURE_DESCRIPTIONS[feat]?.label || feat);
      }
    });
    return matched;
  }, [smilesInput, compoundType, inputMode]);

  // Hill formula parser for current active atoms
  const currentFormula = useMemo(() => {
    if (!dynamicMoleculeData?.atoms || dynamicMoleculeData.atoms.length === 0) return '';
    const counts = {};
    dynamicMoleculeData.atoms.forEach(a => {
      counts[a.element] = (counts[a.element] || 0) + 1;
    });
    
    let formula = '';
    if (counts['C']) {
      formula += `C<sub>${counts['C']}</sub>`;
      delete counts['C'];
    }
    if (counts['H']) {
      formula += `H<sub>${counts['H']}</sub>`;
      delete counts['H'];
    }
    Object.keys(counts).sort().forEach(el => {
      formula += `${el}<sub>${counts[el]}</sub>`;
    });
    return formula;
  }, [dynamicMoleculeData]);

  // Example presets for quick loading
  const smilesPresets = useMemo(() => {
    if (compoundType === 'food') {
      return [
        { label: 'Ethanol (Alcohol)', formula: 'C2H6O', smiles: 'CCO' },
        { label: 'Tyramine (Cheese)', formula: 'C8H11NO', smiles: 'C1=CC(=CC=C1)CCN' },
        { label: 'Caffeine (Coffee/Chocolate)', formula: 'C8H10N4O2', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' },
        { label: 'Calcium Cation', formula: 'Ca', smiles: 'Ca' }
      ];
    } else {
      return [
        { label: 'Acetaminophen (Tylenol)', formula: 'C8H9NO2', smiles: 'CC(=O)NC1=CC=C(O)C=C1' },
        { label: 'Aspirin (NSAID)', formula: 'C9H8O4', smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O' },
        { label: 'Sertraline (Zoloft SSRI)', formula: 'C17H17Cl2N', smiles: 'CNC1CCC(C2=CC(Cl)=C(Cl)C=C2)C3=CC=CC=C13' },
        { label: 'Warfarin (Anticoagulant)', formula: 'C19H16O4', smiles: 'CC(=O)CC(C1=CC=CC=C1)C2=C(O)C3=CC=CC=C3OC2=O' }
      ];
    }
  }, [compoundType]);

  const activeFeaturesKeys = compoundType === 'food' ? FOOD_FEATURES : DRUG_FEATURES;
  const pairingsOptions = compoundType === 'food' ? DRUGS : FOODS;

  return (
    <div className="grid-2 animate-pop" style={{ marginTop: '24px' }}>
      
      {/* Settings Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '26px', marginBottom: '6px' }}>🧪 Molecular Sandbox</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            Synthesize a hypothetical compound by toggling physiological properties or entering SMILES strings, then test how the local AI predicts its interaction.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Toggle compound type */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                1. Select Substance Type
              </label>
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', padding: '3px' }}>
                <button
                  onClick={() => setCompoundType('food')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: compoundType === 'food' ? 'var(--panel-bg-opaque)' : 'transparent',
                    color: compoundType === 'food' ? 'var(--color-brand)' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🥗 Hypothetical Food
                </button>
                <button
                  onClick={() => setCompoundType('drug')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: compoundType === 'drug' ? 'var(--panel-bg-opaque)' : 'transparent',
                    color: compoundType === 'drug' ? 'var(--color-brand)' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  💊 Hypothetical Drug
                </button>
              </div>
            </div>

            {/* Toggle input mode */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                2. Select Input Mode
              </label>
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', padding: '3px', gap: '2px' }}>
                <button
                  onClick={() => setInputMode('checkbox')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: inputMode === 'checkbox' ? 'var(--panel-bg-opaque)' : 'transparent',
                    color: inputMode === 'checkbox' ? 'var(--color-brand)' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ☑️ Marker Checkboxes
                </button>
                <button
                  onClick={() => setInputMode('smiles')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: inputMode === 'smiles' ? 'var(--panel-bg-opaque)' : 'transparent',
                    color: inputMode === 'smiles' ? 'var(--color-brand)' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📝 Advanced SMILES
                </button>
              </div>
            </div>

            {/* Checkbox Grid OR SMILES Textarea */}
            {inputMode === 'checkbox' ? (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  3. Design Molecular Markers (Check to Add Atoms)
                </label>
                
                <div style={{
                  maxHeight: '230px',
                  overflowY: 'auto',
                  border: '1px solid var(--panel-border)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {activeFeaturesKeys.map((featureKey) => {
                    const details = FEATURE_DESCRIPTIONS[featureKey] || { label: featureKey, desc: '' };
                    const isChecked = !!selectedFeatures[featureKey];
                    
                    return (
                      <label 
                        key={featureKey}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxChange(featureKey)}
                          style={{
                            marginTop: '3px',
                            cursor: 'pointer',
                            accentColor: 'var(--color-brand)'
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {details.label}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {details.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  3. Input SMILES String
                </label>
                <textarea
                  value={smilesInput}
                  onChange={(e) => setSmilesInput(e.target.value)}
                  placeholder="e.g. CCO, C1=CC=CC=C1, CC(=O)NC1=CC=C(O)C=C1"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--panel-border)',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />

                {smilesError && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: 'var(--color-danger)',
                    fontWeight: 500
                  }}>
                    ⚠️ {smilesError}
                  </div>
                )}

                {/* Example presets */}
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Quick presets (click to load):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {smilesPresets.map((preset) => (
                      <button
                        key={preset.smiles}
                        onClick={() => setSmilesInput(preset.smiles)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--panel-border)',
                          color: 'var(--text-secondary)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.borderColor = 'var(--color-brand)';
                          e.target.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.borderColor = 'var(--panel-border)';
                          e.target.style.color = 'var(--text-secondary)';
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pairing selection */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                4. Pair with Standard substance
              </label>
              <select
                value={selectedPairId}
                onChange={(e) => setSelectedPairId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--panel-border)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                {pairingsOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>

          </div>
        </div>

      </div>

      {/* 3D Visualizer & prediction Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Visualizer */}
        <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '20px' }}>Synthesized Structure</h3>
            {currentFormula && (
              <span 
                style={{ 
                  fontSize: '14px', 
                  fontFamily: 'var(--font-title)', 
                  fontWeight: 800, 
                  color: 'var(--color-brand)', 
                  background: 'var(--color-brand-light)', 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  border: '1px solid rgba(214, 60, 55, 0.15)'
                }}
                dangerouslySetInnerHTML={{ __html: currentFormula }}
              />
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
            {inputMode === 'smiles' 
              ? 'Calculated 3D coordinates via force-directed molecular relaxation simulation' 
              : 'Interactive 3D model: Carbon core chain dynamically attaching atoms (Ca, K, O, N, F, Cl, S)'}
          </p>

          <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <ThreeCanvas
              moleculeName={inputMode === 'smiles' ? smilesInput : 'Synthesized Compound'}
              moleculeData={dynamicMoleculeData}
            />
          </div>
        </div>

        {/* Prediction Outputs */}
        <div className="glass-panel" style={{ padding: '20px 24px' }}>
          <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>AI Sandbox Prediction</h4>
          
          {predictionResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Output Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: predictionResult.predictedClass === 'safe' 
                  ? 'var(--color-safe-light)' 
                  : predictionResult.predictedClass === 'moderate' 
                    ? 'var(--color-warning-light)' 
                    : 'var(--color-danger-light)',
                color: predictionResult.predictedClass === 'safe' 
                  ? 'var(--color-safe)' 
                  : predictionResult.predictedClass === 'moderate' 
                    ? 'var(--color-warning)' 
                    : 'var(--color-danger)',
                border: '1px solid rgba(255,255,255,0.02)'
              }}>
                {predictionResult.predictedClass === 'safe' && <ShieldCheck size={24} />}
                {predictionResult.predictedClass === 'moderate' && <AlertTriangle size={24} />}
                {predictionResult.predictedClass === 'severe' && <AlertOctagon size={24} />}
                
                <div>
                  <h5 style={{ 
                    fontFamily: 'var(--font-title)', 
                    fontWeight: 800, 
                    fontSize: '15px',
                    textTransform: 'uppercase',
                    color: 'inherit'
                  }}>
                    Classified: {predictionResult.predictedClass === 'safe' ? 'Safe Combination' : predictionResult.predictedClass === 'moderate' ? 'Moderate Warning' : 'Severe Danger'}
                  </h5>
                  <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.8 }}>
                    Safe: {(predictionResult.probabilities[0]*100).toFixed(0)}% | Warning: {(predictionResult.probabilities[1]*100).toFixed(0)}% | Danger: {(predictionResult.probabilities[2]*100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Matched features markers for SMILES */}
              {inputMode === 'smiles' && (
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  border: '1px solid var(--panel-border)'
                }}>
                  <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    🧬 Extracted AI Descriptors
                  </span>
                  {matchedFeaturesInfo && matchedFeaturesInfo.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {matchedFeaturesInfo.map((feat) => (
                        <span 
                          key={feat}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            background: 'rgba(214, 60, 55, 0.08)',
                            color: 'var(--color-brand)',
                            borderRadius: '4px',
                            border: '1px solid rgba(214, 60, 55, 0.15)'
                          }}
                        >
                          {feat}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontStyle: 'italic' }}>
                      No negative interaction markers detected in the SMILES structure (Defaulting to Safe).
                    </span>
                  )}
                </div>
              )}

              {!isModelTrained && (
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  fontSize: '11px',
                  color: 'var(--color-warning)',
                  fontWeight: 500
                }}>
                  <Info size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Note: AI models outputs are randomized until trained under the <b>AI Model Center</b>.
                  </span>
                </div>
              )}

            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Adjust features to calculate predictions.</span>
          )}
        </div>

      </div>

    </div>
  );
}
