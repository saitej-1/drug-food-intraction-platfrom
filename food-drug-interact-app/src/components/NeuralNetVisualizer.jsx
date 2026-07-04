import React, { useMemo } from 'react';
import { Play, RotateCcw, AlertCircle, Info } from 'lucide-react';
import { FOOD_FEATURES, DRUG_FEATURES } from '../data/interactions';

export default function NeuralNetVisualizer({
  network,
  epoch,
  lossHistory,
  isTraining,
  onTrain,
  onReset,
  learningRate,
  setLearningRate,
  targetEpochs,
  setTargetEpochs,
  accuracy
}) {
  
  // Calculate coordinates for nodes in SVG
  const width = 580;
  const height = 340;
  
  const nodes = useMemo(() => {
    const inputX = 60;
    const hiddenX = 280;
    const outputX = 500;
    
    const inputNodes = [];
    const hiddenNodes = [];
    const outputNodes = [];
    
    // Dynamic Input Nodes
    const totalInputs = FOOD_FEATURES.length + DRUG_FEATURES.length;
    const inputSpacing = (height - 30) / totalInputs;
    for (let i = 0; i < totalInputs; i++) {
      const isFood = i < FOOD_FEATURES.length;
      inputNodes.push({
        id: `in-${i}`,
        x: inputX,
        y: 15 + i * inputSpacing,
        label: isFood ? FOOD_FEATURES[i] : DRUG_FEATURES[i - FOOD_FEATURES.length],
        group: isFood ? 'food' : 'drug'
      });
    }
    
    // Hidden Nodes
    const hiddenSize = network ? network.hiddenSize : 10;
    const hiddenSpacing = (height - 60) / hiddenSize;
    for (let i = 0; i < hiddenSize; i++) {
      hiddenNodes.push({
        id: `h-${i}`,
        x: hiddenX,
        y: 30 + i * hiddenSpacing
      });
    }
    
    // 3 Output Nodes
    const outputSpacing = 70;
    const outputLabels = ['Safe', 'Moderate Warning', 'Severe Danger'];
    const outputClasses = ['safe', 'warning', 'danger'];
    for (let i = 0; i < 3; i++) {
      outputNodes.push({
        id: `out-${i}`,
        x: outputX,
        y: height / 2 - outputSpacing + i * outputSpacing,
        label: outputLabels[i],
        class: outputClasses[i]
      });
    }
    
    return { inputNodes, hiddenNodes, outputNodes };
  }, [height, network]);

  // Generate path for the Loss Chart
  const lossChartPath = useMemo(() => {
    if (lossHistory.length < 2) return '';
    
    const chartW = 200;
    const chartH = 75;
    const maxLoss = Math.max(...lossHistory, 1.0);
    const minLoss = 0.0;
    const lossRange = maxLoss - minLoss;
    
    const points = lossHistory.map((loss, idx) => {
      const x = (idx / (lossHistory.length - 1)) * chartW;
      const y = chartH - ((loss - minLoss) / lossRange) * chartH;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }, [lossHistory]);

  // Get current synaptic connection weight lines
  const synapses = useMemo(() => {
    if (!network) return [];
    
    const lines = [];
    
    // w1: Input to Hidden
    const totalInputsCount = FOOD_FEATURES.length + DRUG_FEATURES.length;
    const hiddenSizeVal = network ? network.hiddenSize : 10;
    for (let i = 0; i < totalInputsCount; i++) {
      for (let j = 0; j < hiddenSizeVal; j++) {
        const start = nodes.inputNodes[i];
        const end = nodes.hiddenNodes[j];
        const weight = network.w1[i]?.[j] || 0;
        lines.push({
          key: `w1-${i}-${j}`,
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          weight,
          type: 'input-hidden'
        });
      }
    }
    
    // w2: Hidden to Output
    const hiddenSizeValOut = network ? network.hiddenSize : 10;
    for (let j = 0; j < hiddenSizeValOut; j++) {
      for (let k = 0; k < 3; k++) {
        const start = nodes.hiddenNodes[j];
        const end = nodes.outputNodes[k];
        const weight = network.w2[j]?.[k] || 0;
        lines.push({
          key: `w2-${j}-${k}`,
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          weight,
          type: 'hidden-output'
        });
      }
    }
    
    return lines;
  }, [network, nodes]);

  return (
    <div className="grid-2 animate-pop" style={{ marginTop: '24px' }}>
      
      {/* 1. Control Panel Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>AI Model Training Center</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Train a Feedforward Neural Network locally inside your browser. The model analyzes food and drug chemical feature patterns to classify interaction risks.
          </p>
        </div>

        {/* Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Learning Rate (α): {learningRate}
            </label>
            <input 
              type="range" 
              min="0.05" 
              max="0.5" 
              step="0.01" 
              value={learningRate} 
              disabled={isTraining}
              onChange={(e) => setLearningRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-brand)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Target Epochs: {targetEpochs}
            </label>
            <input 
              type="range" 
              min="50" 
              max="500" 
              step="10" 
              value={targetEpochs} 
              disabled={isTraining}
              onChange={(e) => setTargetEpochs(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-brand)' }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="glow-btn" 
            onClick={onTrain} 
            disabled={isTraining}
            style={{ flex: 1, height: '48px', opacity: isTraining ? 0.7 : 1 }}
          >
            {isTraining ? (
              <>
                <span className="animate-pulse-subtle">Training Model...</span>
              </>
            ) : (
              <>
                <Play size={16} /> Train Local Brain
              </>
            )}
          </button>

          <button 
            onClick={onReset} 
            disabled={isTraining}
            style={{ 
              padding: '12px', 
              borderRadius: 'var(--radius-full)', 
              background: 'var(--bg-secondary)', 
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}
            title="Reset Model Weights"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Epoch</span>
            <span style={{ fontSize: '20px', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {epoch} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {targetEpochs}</span>
            </span>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Loss</span>
            <span style={{ fontSize: '20px', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {lossHistory.length > 0 ? lossHistory[lossHistory.length - 1].toFixed(4) : '0.0000'}
            </span>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</span>
            <span style={{ fontSize: '20px', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {(accuracy * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Training Loss Curve Graph */}
        <div>
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Loss Convergence Curve
          </span>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            padding: '16px', 
            borderRadius: 'var(--radius-md)', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            height: '110px'
          }}>
            {lossHistory.length > 1 ? (
              <svg width="200" height="75" style={{ overflow: 'visible' }}>
                <path 
                  d={lossChartPath} 
                  fill="none" 
                  stroke="var(--color-brand)" 
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <Info size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click Train to see learning plot</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Neural Net Visualization Canvas */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ width: '100%', maxWidth: '580px', position: 'relative' }}>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
            
            {/* Synaptic weight lines */}
            {synapses.map((syn) => {
              const absW = Math.abs(syn.weight);
              const color = syn.weight > 0 ? 'rgba(94, 156, 118,' : 'rgba(200, 75, 49,';
              const opacity = Math.min(absW * 1.5, 0.7);
              const strokeWidth = 0.5 + absW * 2.5;
              
              return (
                <line
                  key={syn.key}
                  x1={syn.x1}
                  y1={syn.y1}
                  x2={syn.x2}
                  y2={syn.y2}
                  stroke={`${color} ${opacity})`}
                  strokeWidth={strokeWidth}
                  style={{
                    transition: isTraining ? 'none' : 'stroke 0.4s ease, stroke-width 0.4s ease'
                  }}
                />
              );
            })}

            {/* Input Nodes */}
            {nodes.inputNodes.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="5"
                  fill={node.group === 'food' ? 'var(--color-brand)' : 'var(--text-muted)'}
                  style={{ transition: 'fill 0.3s ease' }}
                />
                {/* Node descriptor on hover or small size */}
                <text
                  x={node.x - 10}
                  y={node.y + 3}
                  textAnchor="end"
                  fill="var(--text-secondary)"
                  style={{ fontSize: '7.5px', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                >
                  {node.label.replace('_', ' ')}
                </text>
              </g>
            ))}

            {/* Hidden Nodes */}
            {nodes.hiddenNodes.map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r="6"
                fill="var(--bg-tertiary)"
                stroke="var(--text-muted)"
                strokeWidth="1"
              />
            ))}

            {/* Output Nodes */}
            {nodes.outputNodes.map((node) => {
              let color = 'var(--text-muted)';
              if (node.class === 'safe') color = 'var(--color-safe)';
              if (node.class === 'warning') color = 'var(--color-warning)';
              if (node.class === 'danger') color = 'var(--color-danger)';
              
              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="8"
                    fill="var(--bg-primary)"
                    stroke={color}
                    strokeWidth="2.5"
                    style={{ transition: 'stroke 0.3s ease' }}
                  />
                  <text
                    x={node.x + 14}
                    y={node.y + 4}
                    textAnchor="start"
                    fill="var(--text-primary)"
                    style={{ fontSize: '10px', fontFamily: 'var(--font-title)', fontWeight: 700 }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}

            {/* Layer labels */}
            <text x="60" y="335" textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em' }}>
              INPUT FEATURES
            </text>
            <text x="280" y="335" textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em' }}>
              HIDDEN LAYER ({network ? network.hiddenSize : 10})
            </text>
            <text x="500" y="335" textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em' }}>
              CLASSIFICATIONS
            </text>
          </svg>

          {/* SVG floating indicators */}
          {isTraining && (
            <div 
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                background: 'rgba(224, 106, 85, 0.1)',
                border: '1px solid rgba(224, 106, 85, 0.2)',
                borderRadius: '4px',
                fontSize: '10px',
                color: 'var(--color-brand)',
                fontWeight: 600
              }}
              className="animate-pulse-subtle"
            >
              <AlertCircle size={10} /> Live Synapse Syncing
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
