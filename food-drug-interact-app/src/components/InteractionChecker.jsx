import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, RefreshCw, Layers } from 'lucide-react';
import { FOODS, DRUGS, PAIRED_INTERACTIONS, MOLECULES } from '../data/interactions';
import { vectorizeInput } from '../utils/neuralNet';
import ThreeCanvas from './ThreeCanvas';
import AutoCompleteSelect from './AutoCompleteSelect';

export default function InteractionChecker({ network, isModelTrained, initialFoodId, initialDrugId }) {
  const [selectedFoodId, setSelectedFoodId] = useState(initialFoodId || FOODS[0].id);
  const [selectedDrugId, setSelectedDrugId] = useState(initialDrugId || DRUGS[0].id);

  useEffect(() => {
    if (initialFoodId) {
      setSelectedFoodId(initialFoodId);
    }
  }, [initialFoodId]);

  useEffect(() => {
    if (initialDrugId) {
      setSelectedDrugId(initialDrugId);
    }
  }, [initialDrugId]);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [activeMoleculeView, setActiveMoleculeView] = useState('both'); // 'food', 'drug', or 'both'
  const [activeStageId, setActiveStageId] = useState('ingestion');

  const pathwayStages = getPathwayStages(selectedFoodId, selectedDrugId, predictionResult?.predictedClass);

  // Sync active stage when substance selection updates to point directly to the metabolic warning site
  useEffect(() => {
    const nextStage = getPathwayStages(selectedFoodId, selectedDrugId, predictionResult?.predictedClass)
      .find(s => s.status !== 'safe')?.id || 'ingestion';
    setActiveStageId(nextStage);
  }, [selectedFoodId, selectedDrugId, predictionResult]);

  // Get active food/drug objects
  const activeFood = FOODS.find(f => f.id === selectedFoodId);
  const activeDrug = DRUGS.find(d => d.id === selectedDrugId);

  // Trigger analysis when food or drug selections change
  const handleAnalyze = useCallback(() => {
    if (!network) return;
    
    setIsAnalyzing(true);
    
    // Simulate a brief AI processing delay for nice animation (500ms)
    setTimeout(() => {
      const inputVector = vectorizeInput(selectedFoodId, selectedDrugId);
      const forwardState = network.forward(inputVector);
      const probabilities = forwardState.outputActivations;
      
      // Classify index of max probability
      let predictedIndex = 0;
      let maxProb = -1;
      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          predictedIndex = i;
        }
      }

      const classes = ['safe', 'moderate', 'severe'];
      const predictedClass = classes[predictedIndex];

      // Retrieve known clinical details if matching, or mock feature-based results
      const pairKey = `${selectedFoodId}+${selectedDrugId}`;
      const clinicalData = PAIRED_INTERACTIONS[pairKey];

      setPredictionResult({
        predictedClass,
        probabilities,
        clinicalData,
        inputVector
      });
      setIsAnalyzing(false);
    }, 550);
  }, [network, selectedFoodId, selectedDrugId]);

  // Run initial analysis on mount
  useEffect(() => {
    handleAnalyze();
  }, [handleAnalyze]);

  // Determine active molecular data for 3D render
  const molecularDisplay = (() => {
    if (activeMoleculeView === 'food' && activeFood) {
      return {
        name: activeFood.moleculeName,
        data: MOLECULES[activeFood.moleculeName],
        name2: null,
        data2: null
      };
    } else if (activeMoleculeView === 'drug' && activeDrug) {
      return {
        name: activeDrug.moleculeName,
        data: MOLECULES[activeDrug.moleculeName],
        name2: null,
        data2: null
      };
    } else if (activeMoleculeView === 'both' && activeFood && activeDrug) {
      return {
        name: activeFood.moleculeName,
        data: MOLECULES[activeFood.moleculeName],
        name2: activeDrug.moleculeName,
        data2: MOLECULES[activeDrug.moleculeName]
      };
    }
    return { name: 'Unknown', data: { atoms: [], bonds: [] }, name2: null, data2: null };
  })();

  return (
    <div className="grid-2 animate-pop">
      
      {/* Interaction Setup Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Interaction Profiler</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Food Selection */}
            <div>
              <AutoCompleteSelect
                items={FOODS}
                value={selectedFoodId}
                onChange={setSelectedFoodId}
                placeholder="Search food..."
              />
            </div>

            {/* Drug Selection */}
            <div>
              <AutoCompleteSelect
                items={DRUGS}
                value={selectedDrugId}
                onChange={setSelectedDrugId}
                placeholder="Search drug..."
              />
            </div>
          </div>
        </div>

        {/* Prediction Output Panel */}
        <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
          {isAnalyzing ? (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
              <RefreshCw className="animate-slow-rotate" size={24} style={{ color: 'var(--color-brand)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Neural net performing feedforward computation...</span>
            </div>
          ) : predictionResult ? (
            <>
              {/* Severity Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
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
                border: '1px solid rgba(0,0,0,0.03)'
              }}>
                {predictionResult.predictedClass === 'safe' && <ShieldCheck size={28} />}
                {predictionResult.predictedClass === 'moderate' && <AlertTriangle size={28} />}
                {predictionResult.predictedClass === 'severe' && <AlertOctagon size={28} />}
                
                <div>
                  <h4 style={{ 
                    fontFamily: 'var(--font-title)', 
                    fontWeight: 800, 
                    fontSize: '18px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    color: 'inherit'
                  }}>
                    Local AI Classifies: {predictionResult.predictedClass === 'safe' ? 'Safe combination' : predictionResult.predictedClass === 'moderate' ? 'Moderate Warning' : 'Severe Danger'}
                  </h4>
                  <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8 }}>
                    Probabilities: Safe: {(predictionResult.probabilities[0]*100).toFixed(0)}% | Mod: {(predictionResult.probabilities[1]*100).toFixed(0)}% | Sev: {(predictionResult.probabilities[2]*100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Status Alert for Untrained Model */}
              {!isModelTrained && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(224, 159, 62, 0.08)',
                  border: '1px solid rgba(224, 159, 62, 0.15)',
                  fontSize: '11px',
                  color: 'var(--color-warning)',
                  fontWeight: 500
                }}>
                  <Layers size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Note: The local network has not been trained yet. Go to the <b>AI Model Center</b> tab to train the weights, or outputs may be inaccurate.
                  </span>
                </div>
              )}

              {/* Clinical Detail Sheets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                  {predictionResult.clinicalData ? predictionResult.clinicalData.title : 'Feature Synthesis Analysis'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                  {predictionResult.clinicalData 
                    ? predictionResult.clinicalData.mechanism 
                    : `The neural network evaluated the input descriptors: [${predictionResult.inputVector.map((v, i) => v === 1 ? (i < 7 ? FOODS[0].features[i] ? 'Food' : 'F' + i : 'Drug') : '').filter(Boolean).join(', ') || 'No markers'}]. Based on trained weight vectors, it classified this combination as generally safe with low chemical affinity.`}
                </p>
                
                {predictionResult.clinicalData && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '16px', 
                    borderRadius: 'var(--radius-md)', 
                    background: 'var(--bg-secondary)', 
                    borderLeft: '4px solid var(--color-brand)'
                  }}>
                    <h5 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      💡 Recommended Action
                    </h5>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {predictionResult.clinicalData.advice}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Select products above to begin profile matching.</span>
            </div>
          )}
        </div>

        {/* Physiological Pathway Explorer */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '20px' }}>Physiological Pathway Explorer</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Inspect how these substances interact at different metabolic stages in the body. Click nodes to learn details.
          </p>
          
          {/* Horizontal Chain */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            position: 'relative',
            margin: '12px 0 20px 0',
            padding: '0 10px'
          }}>
            {/* Background connector line */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '40px',
              right: '40px',
              height: '2px',
              background: 'var(--panel-border)',
              zIndex: 1
            }} />
            
            {pathwayStages.map((stage) => {
              const isActive = stage.id === activeStageId;
              const isDanger = stage.status === 'danger';
              const isWarning = stage.status === 'warning';
              
              const nodeColor = isDanger 
                ? 'var(--color-danger)' 
                : isWarning 
                  ? 'var(--color-warning)' 
                  : 'var(--color-safe)';
                  
              const bgNodeColor = isDanger 
                ? 'var(--color-danger-light)' 
                : isWarning 
                  ? 'var(--color-warning-light)' 
                  : 'var(--color-safe-light)';
              
              return (
                <div 
                  key={stage.id} 
                  onClick={() => setActiveStageId(stage.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                    position: 'relative',
                    flex: 1
                  }}
                >
                  {/* Glowing Node Circle */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-full)',
                    background: bgNodeColor,
                    border: `2px solid ${isActive ? 'var(--text-primary)' : nodeColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: nodeColor,
                    boxShadow: isActive ? `0 0 16px ${nodeColor}` : 'none',
                    transform: isActive ? 'scale(1.12)' : 'scale(1.0)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: 'var(--radius-full)',
                      background: nodeColor
                    }} />
                  </div>
                  
                  {/* Label */}
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    marginTop: '8px',
                    textAlign: 'center'
                  }}>
                    {stage.name.split(' ')[1]}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Detailed explanation box */}
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--panel-border)',
            minHeight: '100px'
          }}>
            <h4 style={{ 
              fontSize: '13px', 
              fontWeight: 800, 
              color: 'var(--text-primary)', 
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em'
            }}>
              {pathwayStages.find(s => s.id === activeStageId)?.name}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {pathwayStages.find(s => s.id === activeStageId)?.detail}
            </p>
          </div>
        </div>
      </div>

      {/* 3D Model Display Column */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '450px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '20px' }}>Molecular Structure</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Rotate and explore the interacting chemical compounds</p>
          </div>
          
          {/* Toggles */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => setActiveMoleculeView('food')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeMoleculeView === 'food' ? 'var(--panel-bg-opaque)' : 'transparent',
                color: activeMoleculeView === 'food' ? 'var(--color-brand)' : 'var(--text-secondary)',
                boxShadow: activeMoleculeView === 'food' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Food Molecule
            </button>
            <button
              onClick={() => setActiveMoleculeView('drug')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeMoleculeView === 'drug' ? 'var(--panel-bg-opaque)' : 'transparent',
                color: activeMoleculeView === 'drug' ? 'var(--color-brand)' : 'var(--text-secondary)',
                boxShadow: activeMoleculeView === 'drug' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Drug Molecule
            </button>
            <button
              onClick={() => setActiveMoleculeView('both')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeMoleculeView === 'both' ? 'linear-gradient(135deg, var(--color-brand), #ff6b6b)' : 'transparent',
                color: activeMoleculeView === 'both' ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: activeMoleculeView === 'both' ? '0 4px 12px rgba(214, 60, 55, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              🧬 Interaction Space
            </button>
          </div>
        </div>

        {/* The 3D render canvas container */}
        <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <ThreeCanvas 
            moleculeName={molecularDisplay.name} 
            moleculeData={molecularDisplay.data} 
            moleculeName2={molecularDisplay.name2}
            moleculeData2={molecularDisplay.data2}
            interactionClass={predictionResult ? predictionResult.predictedClass : 'safe'}
          />
        </div>
      </div>

    </div>
  );
}

const getPathwayStages = (foodId, drugId, predictedClass) => {
  const stages = [
    {
      id: 'ingestion',
      name: '1. Oral Ingestion',
      icon: 'Stomach',
      status: 'safe',
      detail: 'Standard ingestion. Nutrient molecules and pharmaceutical capsules dissolve in gastric juices, preparing for gastrointestinal transit.'
    },
    {
      id: 'intestine',
      name: '2. Intestinal Absorption',
      icon: 'Layers',
      status: 'safe',
      detail: 'Molecules pass through the enterocyte wall. Active drug agents rely on intestinal passive transport or protein carriers to reach blood vessels.'
    },
    {
      id: 'liver',
      name: '3. Hepatic Clearance',
      icon: 'Filter',
      status: 'safe',
      detail: 'First-pass metabolism: Liver cells screen circulation. Cytochrome P450 enzymes (such as CYP3A4) process compounds before general circulation.'
    },
    {
      id: 'circulation',
      name: '4. Systemic Circulation',
      icon: 'Heart',
      status: 'safe',
      detail: 'Active compounds travel through the blood stream, binding to target organs and cardiovascular receptors to exert therapeutic effects.'
    }
  ];

  const isSevere = predictedClass === 'severe';
  const statusToUse = isSevere ? 'danger' : 'warning';

  if (foodId === 'dairy' && drugId === 'ciprofloxacin') {
    stages[0].status = statusToUse;
    stages[0].detail = '🚨 Calcium Chelation Triggered: Calcium ions in dairy bind to ciprofloxacin molecules in the stomach, forming large insoluble complexes. This prevents absorption from the start.';
    stages[1].status = statusToUse;
    stages[1].detail = '⚠️ Decreased Intestinal Transport: Due to calcium-antibiotic binding in the stomach, the complex cannot cross the gut mucosa, reducing therapeutic absorption by 50%.';
  } else if (foodId === 'fiber_oats' && drugId === 'digoxin') {
    stages[0].status = statusToUse;
    stages[0].detail = '🚨 Mechanical Fibrous Trapping: Soluble beta-glucan fibers physically trap digoxin molecules, blocking them from dissolving cleanly in gastric fluids.';
    stages[1].status = statusToUse;
    stages[1].detail = '⚠️ Blocked Intestinal Entry: Trapped digoxin molecules are carried through the colon without being absorbed, lowering cardiotonic efficiency.';
  } else if (foodId === 'grapefruit' && (drugId === 'atorvastatin' || drugId === 'amlodipine')) {
    stages[1].status = statusToUse;
    stages[1].detail = '🚨 CYP3A4 Enzyme Deactivation: Furanocoumarins in grapefruit temporarily deactivate CYP3A4 enzymes in the intestinal wall, allowing more active drug to leak into portal veins.';
    stages[2].status = statusToUse;
    stages[2].detail = '⚠️ Hepatic Saturation: The liver receives a massive surge of active drug from the gut. Liver enzyme capacity is overwhelmed, leading to high systemic drug concentrations.';
  } else if (foodId === 'apple_juice' && drugId === 'fexofenadine') {
    stages[1].status = statusToUse;
    stages[1].detail = '🚨 Transporter Blocking: Naringin in fruit juices blocks OATP1A2 carriers in the enterocytes. The drug cannot bind to these carriers to enter the bloodstream, dropping bioavailability by 70%.';
  } else if (foodId === 'st_johns_wort' && (drugId === 'contraceptive' || drugId === 'sertraline' || drugId === 'atorvastatin')) {
    stages[2].status = statusToUse;
    stages[2].detail = '🚨 Hepatic Enzyme Induction: Hyperforin binds to liver receptors (PXR), signaling cells to produce excessive CYP3A4 proteins, accelerating drug breakdown.';
    stages[3].status = statusToUse;
    stages[3].detail = '⚠️ Rapid Clearance: The drug is metabolized and cleared too quickly from blood vessels, causing therapeutic failure (e.g. breakthrough bleeding or loss of SSRI efficacy).';
  } else if (foodId === 'broccoli' && drugId === 'theophylline') {
    stages[2].status = statusToUse;
    stages[2].detail = '🚨 CYP1A2 Induction: Cruciferous indoles induce hepatic CYP1A2. Theophylline is metabolized primarily by this pathway, causing the liver to clear the drug at high speed.';
  } else if (foodId === 'cranberry_juice' && drugId === 'warfarin') {
    stages[2].status = statusToUse;
    stages[2].detail = '🚨 CYP2C9 Enzyme Block: Cranberry flavonoids inhibit the CYP2C9 pathway. This blocks the liver from clearing active Warfarin, causing drug accumulation.';
    stages[3].status = statusToUse;
    stages[3].detail = '⚠️ High Bleeding Risk: Excess circulating Warfarin keeps blood coagulation factors deactivated, drastically raising INR levels and creating internal bleeding hazards.';
  } else if (foodId === 'alcohol' && drugId === 'acetaminophen') {
    stages[2].status = statusToUse;
    stages[2].detail = '🚨 Hepatotoxic Pathway Shift: Alcohol induces hepatic CYP2E1, which converts acetaminophen into toxic NAPQI. This exhausts liver glutathione stores, causing necrosis.';
  } else if (foodId === 'leafy_greens' && drugId === 'warfarin') {
    stages[3].status = statusToUse;
    stages[3].detail = '🚨 Coagulation Clashing: Vitamin K1 from leafy greens directly restores liver clotting factor synthesis. This completely opposes Warfarin, which works by deactivating Vitamin K.';
  } else if ((foodId === 'aged_cheese' || foodId === 'chocolate') && drugId === 'nardil') {
    stages[2].status = statusToUse;
    stages[2].detail = '⚠️ Blocked Tyramine Breakdown: Phenelzine blocks Monoamine Oxidase (MAO) in the gut and liver, preventing the destruction of ingested tyramine.';
    stages[3].status = statusToUse;
    stages[3].detail = '🚨 Hypertensive Crisis: Tyramine floods systemic circulation, releasing massive stores of norepinephrine from synaptic vesicles, causing acute vasoconstriction and pressure surges.';
  } else if (foodId === 'bananas' && (drugId === 'lisinopril' || drugId === 'spironolactone')) {
    stages[3].status = statusToUse;
    stages[3].detail = '🚨 Hyperkalemia Trigger: ACE inhibitors cause the kidneys to retain potassium. Introducing potassium-rich bananas adds additive potassium, endangering heart rhythms.';
  } else if (foodId === 'garlic_ginkgo' && (drugId === 'aspirin' || drugId === 'warfarin')) {
    stages[3].status = statusToUse;
    stages[3].detail = '🚨 Additive Bleeding Action: Ginkgolides and garlic compounds possess natural antiplatelet activity. Combined with aspirin/warfarin, they synergize to inhibit blood clotting.';
  } else if (foodId === 'ginseng' && drugId === 'metformin') {
    stages[3].status = statusToUse;
    stages[3].detail = '🚨 Additive Hypoglycemia: Ginsenosides stimulate insulin release and muscle glucose uptake, causing Metformin-regulated blood glucose to plummet too low.';
  } else if (foodId === 'alcohol' && (drugId === 'sertraline' || drugId === 'nardil')) {
    stages[3].status = statusToUse;
    stages[3].detail = '🚨 CNS Depressive Addition: Ethanol synergizes with psychotropics to suppress central nervous systems, leading to extreme drowsiness, slowed breathing, and coordination loss.';
  } else if (predictedClass === 'severe') {
    stages[2].status = 'danger';
    stages[2].detail = '🚨 Direct Metabolic Clash: The neural network predicted a severe interaction, indicating that these active compounds clash during liver enzyme screening or cellular binding.';
  } else if (predictedClass === 'moderate') {
    stages[2].status = 'warning';
    stages[2].detail = '⚠️ Metabolic Interference: The neural net classified this as a moderate warning, predicting competitive receptor binding or altered clearance speeds.';
  }

  return stages;
};
