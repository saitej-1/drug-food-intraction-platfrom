import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Activity, Library, Sun, Moon, Info, CheckCircle2, FlaskConical } from 'lucide-react';
import { NeuralNetwork, generateTrainingData } from './utils/neuralNet';
import InteractionChecker from './components/InteractionChecker';
import NeuralNetVisualizer from './components/NeuralNetVisualizer';
import QuickExplorer from './components/QuickExplorer';
import BloodStreamBackground from './components/BloodStreamBackground';
import MolecularSandbox from './components/MolecularSandbox';

export default function App() {
  const [activeTab, setActiveTab] = useState('checker');
  const [theme, setTheme] = useState('dark');
  
  // Neural Network States
  const networkRef = useRef(null);
  const [epoch, setEpoch] = useState(0);
  const [targetEpochs, setTargetEpochs] = useState(200);
  const [learningRate, setLearningRate] = useState(0.15);
  const [lossHistory, setLossHistory] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [isModelTrained, setIsModelTrained] = useState(false);

  // Initialize Neural Network once on mount
  useEffect(() => {
    networkRef.current = new NeuralNetwork();
    calculateAccuracy();
  }, []);

  // Sync theme selection to HTML tag attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Calculate current accuracy of the model on the full training dataset
  const calculateAccuracy = () => {
    if (!networkRef.current) return;
    
    const dataset = generateTrainingData();
    let correct = 0;
    
    dataset.forEach((data) => {
      const state = networkRef.current.forward(data.input);
      const pred = state.outputActivations;
      
      let maxIdx = 0;
      let maxVal = -1;
      pred.forEach((val, idx) => {
        if (val > maxVal) {
          maxVal = val;
          maxIdx = idx;
        }
      });
      
      if (data.target[maxIdx] === 1) {
        correct++;
      }
    });
    
    setAccuracy(correct / dataset.length);
  };

  // Run the training loop step-by-step
  const handleTrain = () => {
    if (!networkRef.current || isTraining) return;
    
    setIsTraining(true);
    const dataset = generateTrainingData();
    let currentEpoch = 0;
    const history = [];

    const runEpochBatch = () => {
      // Train for 2 epochs per animation frame for a nice visual speed
      const batchSize = 3;
      let lastLoss = 0;

      for (let b = 0; b < batchSize; b++) {
        if (currentEpoch >= targetEpochs) break;
        
        let epochLoss = 0;
        // Shuffle dataset before each epoch for better gradient descent convergence
        const shuffled = [...dataset].sort(() => Math.random() - 0.5);
        
        shuffled.forEach((data) => {
          const loss = networkRef.current.trainStep(data.input, data.target, learningRate);
          epochLoss += loss;
        });
        
        lastLoss = epochLoss / dataset.length;
        currentEpoch++;
        history.push(lastLoss);
      }

      setEpoch(currentEpoch);
      setLossHistory([...history]);
      
      // Update accuracy live during training
      calculateAccuracy();

      if (currentEpoch < targetEpochs) {
        requestAnimationFrame(runEpochBatch);
      } else {
        setIsTraining(false);
        setIsModelTrained(true);
      }
    };

    requestAnimationFrame(runEpochBatch);
  };

  // Reset neural weights back to randomized defaults
  const handleReset = () => {
    if (!networkRef.current || isTraining) return;
    networkRef.current.initializeWeights();
    setEpoch(0);
    setLossHistory([]);
    setIsModelTrained(false);
    calculateAccuracy();
  };

  // Handle card select action to load checker and switch tabs
  const handleSelectInteraction = (foodId, drugId) => {
    // We update values by triggering custom events or relying on React rendering state
    // To make it easy, we store the selected items in sessionStorage or pass them,
    // but the cleanest way is adding query states. Since it is small, we can pass them in App.
    setActiveTab('checker');
    // We can also trigger selections in checker by passing selectors or using a shared state.
    // Let's create a shared state for selection so that clicks sync perfectly!
    setSharedSelection({ foodId, drugId });
    
    // Smooth scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Selection state shared between QuickExplorer and InteractionChecker
  const [sharedSelection, setSharedSelection] = useState(null);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app-container">
      <BloodStreamBackground />
      {/* 1. Sleek Navigation Header */}
      <header className="site-header">
        <div className="logo">
          <Activity size={22} style={{ color: 'var(--color-brand)' }} />
          <span>Aegis<span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>AI</span></span>
        </div>

        <nav className="nav-links">
          <div 
            className={`nav-tab ${activeTab === 'checker' ? 'active' : ''}`}
            onClick={() => setActiveTab('checker')}
          >
            <Sparkles size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Profiler
          </div>
          <div 
            className={`nav-tab ${activeTab === 'reference' ? 'active' : ''}`}
            onClick={() => setActiveTab('reference')}
          >
            <Library size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Reference
          </div>
          <div 
            className={`nav-tab ${activeTab === 'sandbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('sandbox')}
          >
            Lab Sandbox
          </div>
          <div 
            className={`nav-tab ${activeTab === 'neuralnet' ? 'active' : ''}`}
            onClick={() => setActiveTab('neuralnet')}
          >
            <Activity size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            AI Model Center
          </div>
        </nav>

        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      {/* 2. Main Page Content */}
      <main className="main-content">
        
        {/* Banner notifying successful training */}
        {isModelTrained && activeTab !== 'neuralnet' && (
          <div className="animate-pop" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            background: 'var(--color-safe-light)',
            color: 'var(--color-safe)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-safe)',
            marginBottom: '24px',
            fontSize: '13px',
            fontWeight: 600
          }}>
            <CheckCircle2 size={16} />
            <span>Local AI neural net trained successfully! Accuracy is at {(accuracy*100).toFixed(0)}%. Interaction predictions are active.</span>
          </div>
        )}

        {/* Tab rendering with keyed transition container */}
        <div key={activeTab} className="animate-tab-change" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {activeTab === 'checker' && (
            <InteractionChecker 
              network={networkRef.current} 
              isModelTrained={isModelTrained}
              accuracy={accuracy}
              initialFoodId={sharedSelection?.foodId}
              initialDrugId={sharedSelection?.drugId}
            />
          )}

          {activeTab === 'reference' && (
            <QuickExplorer 
              onSelectInteraction={handleSelectInteraction} 
            />
          )}

          {activeTab === 'neuralnet' && (
            <NeuralNetVisualizer
              network={networkRef.current}
              epoch={epoch}
              lossHistory={lossHistory}
              isTraining={isTraining}
              onTrain={handleTrain}
              onReset={handleReset}
              learningRate={learningRate}
              setLearningRate={setLearningRate}
              targetEpochs={targetEpochs}
              setTargetEpochs={setTargetEpochs}
              accuracy={accuracy}
            />
          )}

          {activeTab === 'sandbox' && (
            <MolecularSandbox
              network={networkRef.current}
              isModelTrained={isModelTrained}
            />
          )}
        </div>
      </main>

      {/* 3. Lovable warnings footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--panel-border)',
        background: 'var(--bg-secondary)',
        padding: '32px 24px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-muted)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Info size={14} /> Educational Laboratory & Simulator
          </div>
          <p style={{ lineHeight: '1.6' }}>
            Aegis AI is an interactive client-side simulator illustrating basic biological feature vectorizations, neural network gradient descents, and WebGL molecular stick structures. This does not substitute professional clinical consultations. Always speak with your pharmacist or doctor before adjusting your dietary patterns or prescription schedules.
          </p>
          <p style={{ marginTop: '8px', fontSize: '10px' }}>
            © {new Date().getFullYear()} Aegis AI. Developed with Three.js and custom browser Neural Networks.
          </p>
        </div>
      </footer>
    </div>
  );
}
