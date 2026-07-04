/**
 * SMILES Chemical Parser & 3D Force-Directed Layout Generator
 * Offline molecular stick compiler in Javascript.
 */

// 1. SMILES Parsing: Converts notation string to atoms & bonds graph
export function parseSmiles(smiles) {
  if (!smiles) return { atoms: [], bonds: [] };

  const atoms = [];
  const bonds = [];
  let atomId = 0;

  const stack = []; // For branches: store parent atom index
  const rings = {}; // For ring closures: store starting atom index by ring identifier

  let i = 0;
  let activeIndex = null;
  let nextBondType = 1; // Default to single bond

  // Strip whitespace
  const cleanSmiles = smiles.replace(/\s+/g, '');

  while (i < cleanSmiles.length) {
    const char = cleanSmiles[i];

    // Branch opening
    if (char === '(') {
      stack.push(activeIndex);
      i++;
      continue;
    }
    // Branch closing
    if (char === ')') {
      activeIndex = stack.pop();
      i++;
      continue;
    }

    // Bond symbols
    if (char === '-') {
      nextBondType = 1;
      i++;
      continue;
    }
    if (char === '=') {
      nextBondType = 2;
      i++;
      continue;
    }
    if (char === '#') {
      nextBondType = 3;
      i++;
      continue;
    }

    // Ring closure numbers (Single digit or two-digit preceded by %)
    if (char >= '0' && char <= '9') {
      const ringNum = char;
      if (rings[ringNum] !== undefined) {
        // Connect active node to the ring start node
        bonds.push({
          source: activeIndex,
          target: rings[ringNum],
          value: nextBondType
        });
        rings[ringNum] = undefined;
      } else {
        rings[ringNum] = activeIndex;
      }
      nextBondType = 1;
      i++;
      continue;
    }
    
    // Percent ring closure (e.g. %12)
    if (char === '%') {
      const ringNum = cleanSmiles.substr(i + 1, 2);
      if (rings[ringNum] !== undefined) {
        bonds.push({
          source: activeIndex,
          target: rings[ringNum],
          value: nextBondType
        });
        rings[ringNum] = undefined;
      } else {
        rings[ringNum] = activeIndex;
      }
      nextBondType = 1;
      i += 3;
      continue;
    }

    // Elements parsing
    let element = '';
    // Look ahead for double-character elements
    if (i < cleanSmiles.length - 1) {
      const doubleChar = cleanSmiles.substr(i, 2);
      if (['Cl', 'Ca', 'Br', 'Na', 'Mg'].includes(doubleChar)) {
        element = doubleChar;
        i += 2;
      }
    }

    if (!element) {
      const singleChar = cleanSmiles[i];
      // Include lowercase aromatic symbols (c, n, o, s, p)
      if (['C', 'H', 'O', 'N', 'F', 'P', 'S', 'K', 'I', 'c', 'n', 'o', 's', 'p'].includes(singleChar)) {
        element = singleChar.toUpperCase();
        i++;
      } else {
        // Skip unrecognized symbols (brackets, charges, etc. like [C], [O-]) to stay robust
        i++;
        continue;
      }
    }

    // Instantiate new atom node
    const newAtom = {
      id: atomId++,
      element: element,
      pos: [0, 0, 0] // Laid out in next phase
    };
    atoms.push(newAtom);

    const newIndex = newAtom.id;

    // Connect to active parent if present
    if (activeIndex !== null) {
      bonds.push({
        source: activeIndex,
        target: newIndex,
        value: nextBondType
      });
    }

    activeIndex = newIndex;
    nextBondType = 1; // reset to single bond
  }

  return { atoms, bonds };
}

// 2. 3D Force-Directed Physics Simulation Layout
export function layout3D(molecule) {
  const { atoms, bonds } = molecule;
  if (atoms.length === 0) return molecule;

  // Initialize random 3D positions in a small central cluster
  atoms.forEach((atom) => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 0.4 + Math.random() * 0.4;
    atom.pos = [
      Math.sin(phi) * Math.cos(theta) * r,
      Math.sin(phi) * Math.sin(theta) * r,
      Math.cos(phi) * r
    ];
  });

  const iterations = 180;
  const k = 0.12;      // Attraction spring factor
  const c = 0.28;      // Repulsion force factor
  const d0 = 1.05;     // Equilibrium covalent bond distance

  // Physics simulation loops
  for (let step = 0; step < iterations; step++) {
    const forces = atoms.map(() => [0, 0, 0]);

    // Repulsion forces (ALL pairs push apart)
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dx = atoms[j].pos[0] - atoms[i].pos[0];
        const dy = atoms[j].pos[1] - atoms[i].pos[1];
        const dz = atoms[j].pos[2] - atoms[i].pos[2];

        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.05;

        // Electrostatic repulsion 1/d^2
        const forceMag = c / (dist * dist);
        const fx = (dx / dist) * forceMag;
        const fy = (dy / dist) * forceMag;
        const fz = (dz / dist) * forceMag;

        forces[i][0] -= fx;
        forces[i][1] -= fy;
        forces[i][2] -= fz;

        forces[j][0] += fx;
        forces[j][1] += fy;
        forces[j][2] += fz;
      }
    }

    // Attraction forces (Connected bonds pull together)
    bonds.forEach((bond) => {
      const a1 = atoms[bond.source];
      const a2 = atoms[bond.target];
      if (!a1 || !a2) return;

      const dx = a2.pos[0] - a1.pos[0];
      const dy = a2.pos[1] - a1.pos[1];
      const dz = a2.pos[2] - a1.pos[2];

      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.05;

      // Hooke's Law: F = k * (x - x_0)
      const displacement = dist - d0;
      const forceMag = k * displacement;
      const fx = (dx / dist) * forceMag;
      const fy = (dy / dist) * forceMag;
      const fz = (dz / dist) * forceMag;

      forces[bond.source][0] += fx;
      forces[bond.source][1] += fy;
      forces[bond.source][2] += fz;

      forces[bond.target][0] -= fx;
      forces[bond.target][1] -= fy;
      forces[bond.target][2] -= fz;
    });

    // Apply accumulated forces with simulated cooling (damping decrease)
    const damping = Math.max(0.08, 0.9 - (step / iterations) * 0.82);
    atoms.forEach((atom, idx) => {
      atom.pos[0] += forces[idx][0] * damping;
      atom.pos[1] += forces[idx][1] * damping;
      atom.pos[2] += forces[idx][2] * damping;
    });
  }

  // 3. Center gravity at origin [0,0,0]
  let cx = 0, cy = 0, cz = 0;
  atoms.forEach((atom) => {
    cx += atom.pos[0];
    cy += atom.pos[1];
    cz += atom.pos[2];
  });
  cx /= atoms.length;
  cy /= atoms.length;
  cz /= atoms.length;

  atoms.forEach((atom) => {
    atom.pos[0] -= cx;
    atom.pos[1] -= cy;
    atom.pos[2] -= cz;
  });

  return molecule;
}

// 3. Vector Feature Extractor: Matches parsed chemical structures to vector markers
export function extractFeaturesFromSmiles(smiles, type) {
  // Return arrays corresponding to FOOD_FEATURES or DRUG_FEATURES
  const clean = smiles.toUpperCase();

  if (type === 'food') {
    // food features: cyp3a4_inhibitor, vitamin_k_rich, calcium_rich, tyramine_rich, potassium_rich, alcohol_present, fiber_rich, oatp_inhibitor, glycyrrhizin, cyp1a2_inducer, ginkgolide, hypoglycemic_herb, cyp3a4_inducer, cyp2c9_inhibitor, methylxanthines
    return [
      clean.includes('C1=CC(=CC=C1)CCN') ? 1 : 0, // tyramine-like benzene + ethylamine
      clean.includes('CA') ? 1 : 0,               // calcium
      clean.includes('K') && !clean.includes('O') ? 1 : 0, // potassium (lone K)
      clean.includes('CCO') || clean === 'CCO' ? 1 : 0, // ethanol
      clean.includes('C1=CC2=C(C=C1)OC(=O)C=C2') ? 1 : 0, // furanocoumarin / cyp3a4 inhibitor-like
      clean.includes('C1=CC(=O)OC2=C1') ? 1 : 0,  // vitamin k quinone
      clean.includes('O1C(CO)C(O)C(O)C1') ? 1 : 0, // soluble fiber / sugar pyran
      clean.includes('O=C(O)C1=CC=CC=C1') ? 1 : 0, // oatp / benzoic acid
      clean.includes('O=C1CC(O)C2(C)C3') ? 1 : 0,  // glycyrrhizin steroid core
      clean.includes('C1=C[NH]C2=CC=CC=C12') ? 1 : 0, // cyp1a2 inducer indole
      clean.includes('O1C(=O)C23C(O)C4') ? 1 : 0,  // ginkgolide ginkgo lactone
      clean.includes('C1C(O)C2(C)C3(C)CCC4') ? 1 : 0, // hypoglycemic ginsenoside
      clean.includes('C1=COC2=C1C=CC3=C2OC(=O)C=C3') ? 1 : 0, // cyp3a4 inducer hyperforin/psoralen
      clean.includes('C1=CC=C(C=C1)C2=NC3=CC=CC=C3O2') ? 1 : 0, // cyp2c9 inhibitor flavonoid
      clean.includes('CN1C(=O)N(C)C2=C1N=CN2') || clean.includes('CN1C=NC2=C1C(=O)N') ? 1 : 0 // methylxanthine / caffeine
    ];
  } else {
    // drug features: statin, anticoagulant, antibiotic, maoi, ace_inhibitor, acetaminophen, cardiac_glycoside, calcium_channel, oatp_substrate, cyp1a2_substrate, diuretic_k_sparing, nsaid_antiplatelet, antidiabetic, ssri, contraceptive
    return [
      clean.includes('F') && clean.includes('C(O)CC(O)CC(=O)O') ? 1 : 0, // statin (fluorine + heptanoic acid)
      clean.includes('C1=CC=C(C=C1)C2=C(C(=O)OC3=CC=CC=C23)') ? 1 : 0, // anticoagulant (warfarin-like coumarin)
      clean.includes('C1=CC(=NC=C1)N2C3=CC(F)=C(C(=O)C3=CC(=O)O2)') || clean.includes('N1CCN(CC1)C2=C(F)') ? 1 : 0, // antibiotic (fluoroquinolone ciprofloxacin-like)
      clean.includes('N-N') || clean.includes('NN') ? 1 : 0, // maoi (hydrazine)
      clean.includes('CCCC(NC(C)C(=O)N1CCCC1C(=O)O)') || clean.includes('N1C(C(=O)O)CCC1') ? 1 : 0, // ace inhibitor (lisinopril proline)
      clean.includes('CC(=O)NC1=CC=C(O)C=C1') || clean === 'CC(=O)NC1=CC=C(O)C=C1' ? 1 : 0, // acetaminophen
      clean.includes('CC1(C)OC2C(O)C(OC3CC(O)C(OC4CC(O)C(O)O4)O3)C1') ? 1 : 0, // cardiac glycoside digoxin
      clean.includes('C1=CC=C(C(=C1)C(=O)OC)C2=C(C(=O)OCC)N') ? 1 : 0, // amlodipine calcium channel blocker
      clean.includes('C1=CC=C(C=C1)CCN') ? 1 : 0, // oatp substrate fexofenadine
      clean.includes('CN1C2=C(NC=N2)C(=O)N(C)C1=O') ? 1 : 0, // theophylline cyp1a2 substrate
      clean.includes('S(=O)(=O)') && clean.includes('NC1=CC=CC=C1') ? 1 : 0, // diuretic
      clean.includes('CC(C)C1=CC=C(C=C1)CC(C)C(=O)O') || clean.includes('C(=O)O') && clean.includes('O(=O)') ? 1 : 0, // nsaid
      clean.includes('N=C(N)N=C(N)N') || clean.includes('NC(N)=N') ? 1 : 0, // metformin / antidiabetic biguanide
      clean.includes('C1=CC(=CC=C1)C(CCN)OC2=CC=CC=C2') || clean.includes('Cl') && clean.includes('C(CN)C') ? 1 : 0, // ssri
      clean.includes('C12CCC3C(C1)CCC4(C)C(=O)CCC34') ? 1 : 0 // contraceptive steroid core
    ];
  }
}
