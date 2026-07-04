// Simple feedforward neural network in pure JS with backpropagation
// Input: 15 nodes (7 food features, 8 drug features)
// Hidden: 8 nodes
// Output: 3 nodes (Safe, Moderate warning, Severe danger)

import { FOODS, DRUGS, PAIRED_INTERACTIONS, FOOD_FEATURES, DRUG_FEATURES } from '../data/interactions';

// Helper: Sigmoid function and its derivative
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const sigmoidDeriv = (s) => s * (1 - s);

// Helper: Softmax activation for output layer classification probabilities
const softmax = (arr) => {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / (sum || 1));
};

export class NeuralNetwork {
  constructor() {
    this.inputSize = FOOD_FEATURES.length + DRUG_FEATURES.length;
    this.hiddenSize = 10;
    this.outputSize = 3;
    
    // Weight matrices
    this.w1 = []; // inputSize x hiddenSize
    this.w2 = []; // hiddenSize x outputSize
    
    // Biases
    this.b1 = new Array(this.hiddenSize).fill(0);
    this.b2 = new Array(this.outputSize).fill(0);
    
    this.initializeWeights();
  }
  
  initializeWeights() {
    // Random weights in [-0.5, 0.5]
    this.w1 = Array.from({ length: this.inputSize }, () =>
      Array.from({ length: this.hiddenSize }, () => Math.random() - 0.5)
    );
    this.w2 = Array.from({ length: this.hiddenSize }, () =>
      Array.from({ length: this.outputSize }, () => Math.random() - 0.5)
    );
    this.b1 = Array.from({ length: this.hiddenSize }, () => Math.random() - 0.5);
    this.b2 = Array.from({ length: this.outputSize }, () => Math.random() - 0.5);
  }

  // Forward propagation
  forward(X) {
    // Hidden layer
    const hiddenInputs = new Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.b1[j];
      for (let i = 0; i < this.inputSize; i++) {
        sum += X[i] * this.w1[i][j];
      }
      hiddenInputs[j] = sum;
    }
    const hiddenActivations = hiddenInputs.map(sigmoid);

    // Output layer
    const outputInputs = new Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      let sum = this.b2[k];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hiddenActivations[j] * this.w2[j][k];
      }
      outputInputs[k] = sum;
    }
    const outputActivations = softmax(outputInputs);

    return {
      inputs: X,
      hiddenInputs,
      hiddenActivations,
      outputInputs,
      outputActivations
    };
  }

  // Backpropagation for a single training step
  trainStep(X, yTrue, lr) {
    // Forward pass
    const netState = this.forward(X);
    const yPred = netState.outputActivations;
    const h = netState.hiddenActivations;

    // Error at output layer
    // (using derivative of Cross-Entropy Loss with Softmax activation)
    const dOut = new Array(this.outputSize);
    for (let k = 0; k < this.outputSize; k++) {
      dOut[k] = yPred[k] - yTrue[k];
    }

    // Gradients for w2 and b2
    const dw2 = Array.from({ length: this.hiddenSize }, () => new Array(this.outputSize).fill(0));
    const db2 = [...dOut];
    
    for (let j = 0; j < this.hiddenSize; j++) {
      for (let k = 0; k < this.outputSize; k++) {
        dw2[j][k] = h[j] * dOut[k];
      }
    }

    // Error backpropagated to hidden layer
    const dHidden = new Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = 0;
      for (let k = 0; k < this.outputSize; k++) {
        sum += dOut[k] * this.w2[j][k];
      }
      dHidden[j] = sum * sigmoidDeriv(h[j]);
    }

    // Gradients for w1 and b1
    const dw1 = Array.from({ length: this.inputSize }, () => new Array(this.hiddenSize).fill(0));
    const db1 = [...dHidden];

    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        dw1[i][j] = X[i] * dHidden[j];
      }
    }

    // Update weights and biases
    for (let j = 0; j < this.hiddenSize; j++) {
      for (let k = 0; k < this.outputSize; k++) {
        this.w2[j][k] -= lr * dw2[j][k];
      }
    }
    // Update bias 2
    for (let k = 0; k < this.outputSize; k++) {
      this.b2[k] -= lr * db2[k];
    }

    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.w1[i][j] -= lr * dw1[i][j];
      }
    }
    for (let j = 0; j < this.hiddenSize; j++) {
      this.b1[j] -= lr * db1[j];
    }

    // Calculate cross entropy loss
    let loss = 0;
    for (let k = 0; k < this.outputSize; k++) {
      if (yTrue[k] === 1) {
        loss -= Math.log(Math.max(yPred[k], 1e-15));
      }
    }

    return loss;
  }
}

// Generate the fully expanded training dataset based on foods and drugs features
export const generateTrainingData = () => {
  const data = [];
  
  FOODS.forEach((food) => {
    DRUGS.forEach((drug) => {
      // Concatenate features
      const inputVector = [...food.features, ...drug.features];
      
      // Determine target label
      const pairKey = `${food.id}+${drug.id}`;
      const interaction = PAIRED_INTERACTIONS[pairKey];
      
      let target = [1, 0, 0]; // Default: Safe [1, 0, 0]
      if (interaction) {
        if (interaction.severity === 'moderate') {
          target = [0, 1, 0]; // Moderate [0, 1, 0]
        } else if (interaction.severity === 'severe') {
          target = [0, 0, 1]; // Severe [0, 0, 1]
        }
      }
      
      data.push({
        input: inputVector,
        target,
        foodName: food.name,
        drugName: drug.name,
        key: pairKey
      });
    });
  });

  return data;
};

// Vectorize a custom description or selected names
export const vectorizeInput = (foodId, drugId) => {
  const food = FOODS.find((f) => f.id === foodId);
  const drug = DRUGS.find((d) => d.id === drugId);
  
  const foodVec = food ? food.features : new Array(FOOD_FEATURES.length).fill(0);
  const drugVec = drug ? drug.features : new Array(DRUG_FEATURES.length).fill(0);
  
  return [...foodVec, ...drugVec];
};
