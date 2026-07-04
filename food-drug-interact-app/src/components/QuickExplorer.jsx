import React, { useState } from 'react';
import { ArrowRight, AlertTriangle, AlertOctagon, X, Atom, Search } from 'lucide-react';
import { PAIRED_INTERACTIONS, FOODS, DRUGS, MOLECULES } from '../data/interactions';
import ThreeCanvas from './ThreeCanvas';

// Hill System Chemical Formula Parser
function getFormulaAndComposition(atoms) {
  if (!atoms) return { formula: 'Unknown', composition: {} };
  const counts = {};
  atoms.forEach(a => {
    counts[a.element] = (counts[a.element] || 0) + 1;
  });
  
  // Sort: C first, H second, then alphabetical
  const elements = Object.keys(counts).sort((a, b) => {
    if (a === 'C') return -1;
    if (b === 'C') return 1;
    if (a === 'H') return -1;
    if (b === 'H') return 1;
    return a.localeCompare(b);
  });
  
  const formulaParts = elements.map(el => {
    const count = counts[el];
    return `${el}${count > 1 ? count : ''}`;
  });
  
  return {
    formula: formulaParts.join(''),
    composition: counts
  };
}

// Renders chemical formula with HTML sub-scripts
function renderChemicalFormula(formulaStr) {
  const matches = formulaStr.match(/[A-Z][a-z]?\d*/g);
  if (!matches) return formulaStr;
  
  return matches.map((part, index) => {
    const el = part.match(/[A-Z][a-z]?/)[0];
    const num = part.replace(el, '');
    return (
      <span key={index} style={{ fontFamily: 'monospace', fontWeight: 800 }}>
        {el}
        {num && <sub style={{ fontSize: '10px', bottom: '-0.25em', opacity: 0.85 }}>{num}</sub>}
      </span>
    );
  });
}

export default function QuickExplorer({ onSelectInteraction }) {
  const [activeSubTab, setActiveSubTab] = useState('clinical'); // 'clinical' or 'library'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMolecule, setSelectedMolecule] = useState(null);

  // Prepare visual cards by parsing PAIRED_INTERACTIONS keys
  const clinicalCards = Object.entries(PAIRED_INTERACTIONS).map(([key, data]) => {
    const [foodId, drugId] = key.split('+');
    const food = FOODS.find(f => f.id === foodId);
    const drug = DRUGS.find(d => d.id === drugId);
    
    return {
      key,
      foodId,
      drugId,
      foodName: food ? food.name : 'Unknown Food',
      drugName: drug ? drug.name : 'Unknown Drug',
      category: food ? food.category : 'General',
      severity: data.severity,
      title: data.title,
      summary: data.mechanism,
      imageName: foodId // matching generated asset names
    };
  });

  // Extract food molecules dynamically
  const foodMolecules = FOODS.map(f => ({
    name: f.moleculeName,
    sourceName: f.name,
    sourceId: f.id,
    type: 'food',
    description: f.description,
    data: MOLECULES[f.moleculeName]
  }));

  // Extract drug molecules dynamically
  const drugMolecules = DRUGS.map(d => ({
    name: d.moleculeName,
    sourceName: d.name,
    sourceId: d.id,
    type: 'drug',
    description: d.description,
    data: MOLECULES[d.moleculeName]
  }));

  const allMolecules = [...foodMolecules, ...drugMolecules];

  // Filtering lists
  const filteredCards = clinicalCards.filter(card => 
    card.foodName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.drugName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMolecules = allMolecules.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sourceName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-pop" style={{ marginTop: '24px' }}>
      
      {/* Header and Toggle Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>Clinical Explorer & Library</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Explore biochemically proven food-drug interactions or deep-dive into physical 3D molecular structures.
          </p>
        </div>

        {/* Sub-tab segment selector */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          borderBottom: '1px solid var(--panel-border)',
          paddingBottom: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setActiveSubTab('clinical'); setSearchQuery(''); }}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeSubTab === 'clinical' ? 'var(--color-brand-light)' : 'transparent',
                color: activeSubTab === 'clinical' ? 'var(--color-brand)' : 'var(--text-secondary)',
                border: activeSubTab === 'clinical' ? '1px solid var(--color-brand)' : '1px solid transparent',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.02em'
              }}
            >
              📋 Clinical Profiles ({clinicalCards.length})
            </button>
            <button
              onClick={() => { setActiveSubTab('library'); setSearchQuery(''); }}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeSubTab === 'library' ? 'var(--color-brand-light)' : 'transparent',
                color: activeSubTab === 'library' ? 'var(--color-brand)' : 'var(--text-secondary)',
                border: activeSubTab === 'library' ? '1px solid var(--color-brand)' : '1px solid transparent',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.02em'
              }}
            >
              🧬 3D Compound Library ({allMolecules.length})
            </button>
          </div>

          {/* Integrated Search Input */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={activeSubTab === 'clinical' ? "Search interactions..." : "Search molecules..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 16px 8px 36px',
                width: '100%',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--text-primary)',
                border: '1px solid var(--panel-border)',
                fontSize: '13px',
                fontWeight: 500
              }}
            />
          </div>
        </div>
      </div>

      {/* RENDER CLINICAL CARDS SUB-TAB */}
      {activeSubTab === 'clinical' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '24px'
        }}>
          {filteredCards.map((card) => {
            const isSevere = card.severity === 'severe';
            
            return (
              <div 
                key={card.key}
                className="glass-panel"
                onClick={() => onSelectInteraction(card.foodId, card.drugId)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  borderTop: isSevere ? '5px solid var(--color-danger)' : '5px solid var(--color-warning)',
                  height: '100%',
                  transition: 'var(--transition-spring)'
                }}
              >
                {/* Card Thumbnail */}
                <div style={{
                  height: '140px',
                  background: `linear-gradient(135deg, ${isSevere ? 'rgba(200, 75, 49, 0.08)' : 'rgba(224, 159, 62, 0.08)'}, var(--bg-secondary))`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Translucent background fallback symbol */}
                  <div style={{
                    position: 'absolute',
                    fontSize: '44px',
                    opacity: 0.3,
                    userSelect: 'none',
                    filter: 'grayscale(0.2)'
                  }}>
                    {card.foodId === 'fiber_oats' ? '🌾' : 
                     card.foodId === 'grapefruit' ? '🍊' : 
                     card.foodId === 'leafy_greens' ? '🥬' : 
                     card.foodId === 'dairy' ? '🥛' : 
                     card.foodId === 'aged_cheese' ? '🧀' : 
                     card.foodId === 'bananas' ? '🍌' : 
                     card.foodId === 'alcohol' ? '🍷' : '🥗'}
                  </div>

                  {/* Food Image Rendering */}
                  <img 
                    src={`/images/${card.imageName}.png`} 
                    alt={card.foodName}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.85
                    }}
                  />
                  
                  {/* Severity Label */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: isSevere ? 'var(--color-danger)' : 'var(--color-warning)',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {isSevere ? <AlertOctagon size={12} /> : <AlertTriangle size={12} />}
                    {card.severity}
                  </div>
                  
                  {/* Category Banner */}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '16px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {card.category}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.3 }}>
                    {card.foodName} + {card.drugName.split(' ')[0]}
                  </h3>
                  
                  <h4 style={{ 
                    fontSize: '13px', 
                    fontWeight: 700, 
                    color: isSevere ? 'var(--color-danger)' : 'var(--color-warning)',
                    marginBottom: '4px'
                  }}>
                    {card.title}
                  </h4>
                  
                  <p style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-secondary)', 
                    lineHeight: 1.5,
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {card.summary}
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    color: 'var(--color-brand)',
                    marginTop: '12px'
                  }}>
                    Inspect Compounds <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RENDER 3D COMPOUND LIBRARY SUB-TAB */}
      {activeSubTab === 'library' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '20px'
        }}>
          {filteredMolecules.map((mol, idx) => {
            const formulaData = getFormulaAndComposition(mol.data?.atoms);
            
            return (
              <div 
                key={idx}
                className="glass-panel"
                onClick={() => setSelectedMolecule(mol)}
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--panel-bg)',
                  transition: 'var(--transition-spring)'
                }}
              >
                {/* 3D Wireframe Embellishment Icon */}
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-full)',
                  background: mol.type === 'food' ? 'rgba(108, 184, 138, 0.08)' : 'rgba(214, 60, 55, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: mol.type === 'food' ? 'var(--color-safe)' : 'var(--color-brand)',
                  boxShadow: 'inset 0 0 10px rgba(255,255,255,0.02)'
                }}>
                  <Atom className="animate-slow-rotate" size={28} />
                </div>

                <div>
                  <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>{mol.name}</h4>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                    {mol.type === 'food' ? '🥗 Food Nutrient' : '💊 Active Agent'}
                  </div>
                </div>

                <div style={{ 
                  fontSize: '14px', 
                  color: 'var(--color-brand)', 
                  fontWeight: 800,
                  letterSpacing: '0.05em'
                }}>
                  {renderChemicalFormula(formulaData.formula)}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                  Source: {mol.sourceName.split(' ')[0]}
                </div>

                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: 'var(--color-brand)',
                  marginTop: '6px'
                }}>
                  View 3D Structure →
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3D MOLECULAR OVERLAY MODAL */}
      {selectedMolecule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(7, 5, 4, 0.85)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}
        className="animate-pop"
        >
          <div className="glass-panel" style={{
            position: 'relative',
            width: '100%',
            maxWidth: '960px',
            height: '100%',
            maxHeight: '600px',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
            border: '1px solid rgba(214, 60, 55, 0.25)'
          }}>
            {/* Split layout for larger screens */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(300px, 1.2fr) 1fr',
              height: '100%'
            }}>
              {/* Left Column: 3D molecular canvas */}
              <div style={{
                position: 'relative',
                background: 'var(--bg-secondary)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <ThreeCanvas 
                  moleculeName={selectedMolecule.name}
                  moleculeData={selectedMolecule.data}
                />
              </div>
              
              {/* Right Column: details */}
              <div style={{
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                overflowY: 'auto',
                borderLeft: '1px solid var(--panel-border)',
                background: 'var(--bg-primary)'
              }}>
                <div>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: selectedMolecule.type === 'food' ? 'rgba(108, 184, 138, 0.15)' : 'rgba(214, 60, 55, 0.15)',
                    color: selectedMolecule.type === 'food' ? 'var(--color-safe)' : 'var(--color-brand)',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    marginBottom: '8px'
                  }}>
                    {selectedMolecule.type === 'food' ? '🍏 Food Nutrient' : '💊 Active Pharmaceutical'}
                  </div>
                  <h2 style={{ fontSize: '32px', fontWeight: 900 }}>{selectedMolecule.name}</h2>
                  <h4 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Source: {selectedMolecule.sourceName}
                  </h4>
                </div>
                
                {/* Chemical Formula Details */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--panel-border)'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Chemical Details
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Empirical Formula:</span>
                    <span style={{ 
                      fontSize: '20px', 
                      fontWeight: 800, 
                      color: 'var(--color-brand)' 
                    }}>
                      {renderChemicalFormula(getFormulaAndComposition(selectedMolecule.data?.atoms).formula)}
                    </span>
                  </div>
                  
                  {/* Atom count pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(getFormulaAndComposition(selectedMolecule.data?.atoms).composition).map(([element, count]) => {
                      const elNames = { C: 'Carbon', H: 'Hydrogen', O: 'Oxygen', N: 'Nitrogen', F: 'Fluorine', Ca: 'Calcium', K: 'Potassium', Cl: 'Chlorine', S: 'Sulfur' };
                      return (
                        <span key={element} style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                          {elNames[element] || element}: <b>{count}</b>
                        </span>
                      );
                    })}
                  </div>
                </div>
                
                <div>
                  <h5 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Biological Description
                  </h5>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {selectedMolecule.description}
                  </p>
                </div>
                
                {/* Actions */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => {
                      if (selectedMolecule.type === 'food') {
                        onSelectInteraction(selectedMolecule.sourceId, null);
                      } else {
                        onSelectInteraction(null, selectedMolecule.sourceId);
                      }
                      setSelectedMolecule(null);
                    }}
                    className="glow-btn"
                    style={{ flex: 1 }}
                  >
                    Select in Profiler
                  </button>
                  <button
                    onClick={() => setSelectedMolecule(null)}
                    style={{
                      padding: '12px 20px',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            
            {/* Absolute close button */}
            <button
              onClick={() => setSelectedMolecule(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 10
              }}
              title="Close Molecular Viewer"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
