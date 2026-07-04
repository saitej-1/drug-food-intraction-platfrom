import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ZoomIn, ZoomOut } from 'lucide-react';

const ATOM_COLORS = {
  C: 0x4a403a,   // Soft Charcoal
  H: 0xfaf5f2,   // Warm Creamy White
  O: 0xe06a55,   // Soft Crimson Peach
  N: 0x5c86e6,   // Soft Lavender Blue
  F: 0x76b852,   // Soft Sage Green
  Ca: 0xe09f3e,  // Warm Amber / Calcium
  K: 0x9f5ce6,   // Soft Violet / Potassium
  Cl: 0x45b3a2,  // Pastel Teal / Chlorine
  S: 0xe0ca3c,   // Warm Golden Yellow / Sulfur
};

const ATOM_SIZES = {
  C: 0.35,
  H: 0.2,
  O: 0.3,
  N: 0.32,
  F: 0.3,
  Ca: 0.55,
  K: 0.6,
  Cl: 0.45,
  S: 0.4,
};

export default function ThreeCanvas({ moleculeName, moleculeData, moleculeName2, moleculeData2, interactionClass }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const groupRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const reactorGroupRef = useRef(null);
  const reactorTypeRef = useRef(null);
  const reactorElementsRef = useRef([]);
  const centerLightRef = useRef(null);
  
  // Interaction variables
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const rotationTarget = useRef({ x: 0, y: 0.5 });
  const rotationCurrent = useRef({ x: 0, y: 0.5 });
  const hoverOffset = useRef({ x: 0, y: 0 });
  const cameraTargetZ = useRef(8.0);

  const zoomIn = (e) => {
    e.stopPropagation();
    cameraTargetZ.current = Math.max(cameraTargetZ.current - 1.0, 3.0);
  };

  const zoomOut = (e) => {
    e.stopPropagation();
    cameraTargetZ.current = Math.min(cameraTargetZ.current + 1.0, 15.0);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Get containers size
    const width = containerRef.current.clientWidth || 400;
    const height = containerRef.current.clientHeight || 400;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 8;
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 5, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xe06a55, 0.3); // Accent coral light
    dirLight2.position.set(-5, -5, 2);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.5, 10);
    pointLight.position.set(0, 0, 2);
    scene.add(pointLight);

    // 5. Molecule Group
    const moleculeGroup = new THREE.Group();
    scene.add(moleculeGroup);
    groupRef.current = moleculeGroup;

    // 6. Window Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Mouse Event Handlers for Custom Drag and Parallax
    const handleMouseDown = (e) => {
      isDragging.current = true;
      previousMousePosition.current = {
        x: e.clientX,
        y: e.clientY
      };
    };

    const handleMouseMove = (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate normalized hover offset for camera parallax [-0.5, 0.5]
      hoverOffset.current = {
        x: (mouseX / rect.width) - 0.5,
        y: (mouseY / rect.height) - 0.5
      };

      if (!isDragging.current) return;

      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      rotationTarget.current.x += deltaY * 0.008;
      rotationTarget.current.y += deltaX * 0.008;

      previousMousePosition.current = {
        x: e.clientX,
        y: e.clientY
      };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        previousMousePosition.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }
    };

    const handleTouchMove = (e) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.current.y;

      rotationTarget.current.x += deltaY * 0.008;
      rotationTarget.current.y += deltaX * 0.008;

      previousMousePosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };

    const handleWheel = (e) => {
      e.preventDefault();
      cameraTargetZ.current = Math.min(Math.max(cameraTargetZ.current + e.deltaY * 0.005, 3.0), 15.0);
    };

    const el = containerRef.current;
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('touchstart', handleTouchStart);
    el.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);
    el.addEventListener('wheel', handleWheel, { passive: false });

    // 8. Animation Loop
    let lastTime = 0;
    const animate = (time) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      const delta = (time - lastTime) * 0.001;
      lastTime = time;

      // Smooth inertia lerp for dragging
      rotationCurrent.current.x += (rotationTarget.current.x - rotationCurrent.current.x) * 0.1;
      rotationCurrent.current.y += (rotationTarget.current.y - rotationCurrent.current.y) * 0.1;

      if (moleculeGroup) {
        // Natural background drift rotation
        const driftX = Math.sin(time * 0.0005) * 0.05;
        const driftY = Math.cos(time * 0.0004) * 0.05;
        const driftZ = Math.sin(time * 0.0003) * 0.03;

        moleculeGroup.rotation.x = rotationCurrent.current.x + driftX;
        moleculeGroup.rotation.y = rotationCurrent.current.y + driftY;
        moleculeGroup.rotation.z = driftZ;
      }

      // Animate reactor elements if present
      if (reactorGroupRef.current && reactorElementsRef.current.length > 0) {
        // Natural spinning of reactor group
        const rSpeed = reactorTypeRef.current === 'severe' ? 1.5 : reactorTypeRef.current === 'moderate' ? 0.6 : 0.25;
        reactorGroupRef.current.rotation.y += delta * rSpeed;
        
        reactorElementsRef.current.forEach((el) => {
          if (el.type === 'orbiter') {
            el.angle += delta * el.speed;
            if (el.axis === 'xy') {
              el.mesh.position.x = Math.cos(el.angle) * el.radius;
              el.mesh.position.y = Math.sin(el.angle) * el.radius;
            } else {
              el.mesh.position.x = Math.cos(el.angle) * el.radius;
              el.mesh.position.z = Math.sin(el.angle) * el.radius;
            }
          } else if (el.type === 'pulsate') {
            const scaleVal = el.baseScale + Math.sin(time * 0.003 * el.speed) * el.amp;
            el.mesh.scale.set(scaleVal, scaleVal, scaleVal);
          } else if (el.type === 'float') {
            const offset = Math.sin(time * 0.001 * el.speed + el.phase) * el.amplitude;
            el.mesh.position.copy(el.basePos).add(new THREE.Vector3(0, offset, 0));
          } else if (el.type === 'rotate') {
            if (el.axis === 'x') el.mesh.rotation.x += delta * el.speed;
            if (el.axis === 'y') el.mesh.rotation.y += delta * el.speed;
            if (el.axis === 'z') el.mesh.rotation.z += delta * el.speed;
          } else if (el.type === 'spark') {
            // Jagged electricity update
            const positions = el.geom.attributes.position.array;
            for (let j = 0; j <= el.pointsCount; j++) {
              // Leave ends at molecules (x=-1.5 and x=1.5), jitter centers
              if (j > 0 && j < el.pointsCount) {
                positions[j * 3 + 1] = (Math.random() - 0.5) * 0.6; // Y
                positions[j * 3 + 2] = (Math.random() - 0.5) * 0.6; // Z
              }
            }
            el.geom.attributes.position.needsUpdate = true;
          }
        });
      }

      // Parallax effect on camera + zoom lerping
      if (camera) {
        camera.position.z += (cameraTargetZ.current - camera.position.z) * 0.08;
        camera.position.x += (hoverOffset.current.x * 1.5 - camera.position.x) * 0.05;
        camera.position.y += (-hoverOffset.current.y * 1.5 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);
      }

      renderer.render(scene, camera);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      el.removeEventListener('wheel', handleWheel);
      cancelAnimationFrame(animationFrameRef.current);
      if (el && rendererRef.current && rendererRef.current.domElement) {
        el.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Update molecule structure when data changes
  useEffect(() => {
    if (groupRef.current && (moleculeData || moleculeData2)) {
      const group = groupRef.current;
      
      // Clear previous reactor refs
      reactorGroupRef.current = null;
      reactorTypeRef.current = null;
      reactorElementsRef.current = [];
      if (centerLightRef.current) {
        sceneRef.current.remove(centerLightRef.current);
        centerLightRef.current = null;
      }
      
      // Smooth scale-down and reconstruct transition
      let scale = 1.0;
      const shrinkInterval = setInterval(() => {
        scale -= 0.15;
        if (scale <= 0.1) {
          clearInterval(shrinkInterval);
          
          // Clear children
          while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
          }

          // Build new
          if (moleculeData && moleculeData2) {
            // DUAL VIEW: Interaction Space
            
            // 1. Food Molecule Group (Left)
            const subGroup1 = new THREE.Group();
            subGroup1.position.set(-2.4, 0, 0);
            
            const innerGroup1 = new THREE.Group();
            subGroup1.add(innerGroup1);
            buildMolecule(moleculeData, innerGroup1);
            
            // Scale down slightly to fit side-by-side
            subGroup1.scale.set(0.75, 0.75, 0.75);
            group.add(subGroup1);
            
            // 2. Drug Molecule Group (Right)
            const subGroup2 = new THREE.Group();
            subGroup2.position.set(2.4, 0, 0);
            
            const innerGroup2 = new THREE.Group();
            subGroup2.add(innerGroup2);
            buildMolecule(moleculeData2, innerGroup2);
            
            // Scale down slightly to fit side-by-side
            subGroup2.scale.set(0.75, 0.75, 0.75);
            group.add(subGroup2);
            
            // 3. Central Reactor Group
            const reactorGroup = new THREE.Group();
            group.add(reactorGroup);
            reactorGroupRef.current = reactorGroup;
            reactorTypeRef.current = interactionClass;
            
            buildReactor(interactionClass, reactorGroup);
            
          } else if (moleculeData) {
            // SINGLE VIEW
            buildMolecule(moleculeData, group);
          }

          // Grow back up
          let growScale = 0.1;
          const growInterval = setInterval(() => {
            growScale += 0.15;
            if (growScale >= 1.0) {
              group.scale.set(1, 1, 1);
              clearInterval(growInterval);
            } else {
              group.scale.set(growScale, growScale, growScale);
            }
          }, 16);
        } else {
          group.scale.set(scale, scale, scale);
        }
      }, 16);
    }
  }, [moleculeData, moleculeData2, interactionClass]);

  // Renders atoms and bonds into the group
  const buildMolecule = (data, group) => {
    if (!data || !data.atoms) return;

    const atomSpheres = [];

    // Draw atoms
    data.atoms.forEach((atom) => {
      const radius = ATOM_SIZES[atom.element] || 0.3;
      const color = ATOM_COLORS[atom.element] || 0xcccccc;

      // Premium materials
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshPhysicalMaterial({
        color: color,
        roughness: 0.15,
        metalness: 0.1,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        reflectivity: 0.8,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(atom.pos[0], atom.pos[1], atom.pos[2]);
      group.add(mesh);
      atomSpheres.push(mesh);
    });

    // Draw bonds
    if (data.bonds) {
      data.bonds.forEach((bond) => {
        const start = atomSpheres[bond.source];
        const end = atomSpheres[bond.target];
        if (!start || !end) return;

        const startVec = start.position;
        const endVec = end.position;

        const distance = startVec.distanceTo(endVec);

        // Cylinder bond setup
        const bondRadius = 0.07;
        const geometry = new THREE.CylinderGeometry(bondRadius, bondRadius, distance, 12);
        const material = new THREE.MeshPhysicalMaterial({
          color: 0xded8d3,
          roughness: 0.4,
          metalness: 0.2,
        });

        const cylinder = new THREE.Mesh(geometry, material);

        // Position and rotate cylinder to connect the two atoms
        cylinder.position.copy(startVec).add(endVec).multiplyScalar(0.5);

        const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
        const alignAxis = new THREE.Vector3(0, 1, 0); // Default cylinder axis
        cylinder.quaternion.setFromUnitVectors(alignAxis, direction);

        group.add(cylinder);

        // If double bond, create a secondary offset cylinder
        if (bond.value === 2) {
          const cylinder2 = new THREE.Mesh(geometry, material);
          cylinder2.position.copy(cylinder.position);
          cylinder2.quaternion.copy(cylinder.quaternion);
          
          // Offset slightly in perpendicular direction
          const offsetDir = new THREE.Vector3(1, 0, 0).applyQuaternion(cylinder.quaternion).multiplyScalar(0.13);
          cylinder.position.add(offsetDir);
          cylinder2.position.sub(offsetDir);
          
          group.add(cylinder2);
        }
      });
    }

    // Center the group in the scene
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);
  };

  // Helper to build the visual reactor representation inside the 3D scene
  const buildReactor = (type, group) => {
    const elements = [];
    
    if (type === 'safe') {
      // 1. Orbiting Green Rings
      const ringGeom = new THREE.RingGeometry(0.7, 0.73, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x6cb88a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      
      const ring1 = new THREE.Mesh(ringGeom, ringMat);
      ring1.rotation.x = Math.PI / 4;
      group.add(ring1);
      
      const ring2 = new THREE.Mesh(ringGeom, ringMat);
      ring2.rotation.x = -Math.PI / 4;
      ring2.rotation.y = Math.PI / 4;
      group.add(ring2);
      
      // 2. Glowing orbiting spheres
      const sphereGeom = new THREE.SphereGeometry(0.1, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x6cb88a,
        emissive: 0x6cb88a,
        emissiveIntensity: 1.5,
        roughness: 0.1
      });
      
      const orbiterCount = 4;
      for (let i = 0; i < orbiterCount; i++) {
        const sphere = new THREE.Mesh(sphereGeom, sphereMat);
        group.add(sphere);
        elements.push({
          mesh: sphere,
          type: 'orbiter',
          angle: (i * Math.PI * 2) / orbiterCount,
          radius: 0.72,
          speed: 1.2,
          axis: i % 2 === 0 ? 'xy' : 'xz'
        });
      }
      
      // 3. Central light
      const pLight = new THREE.PointLight(0x6cb88a, 1.2, 5);
      pLight.position.set(0, 0, 0);
      group.add(pLight);
      
    } else if (type === 'moderate') {
      // 1. Central glass warning orb
      const glassGeom = new THREE.SphereGeometry(0.45, 32, 32);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xf0b054,
        roughness: 0.15,
        metalness: 0.1,
        transmission: 0.6,
        thickness: 0.3,
        transparent: true,
        opacity: 0.7,
        clearcoat: 0.8
      });
      const centerOrb = new THREE.Mesh(glassGeom, glassMat);
      group.add(centerOrb);
      elements.push({
        mesh: centerOrb,
        type: 'pulsate',
        speed: 2.5,
        baseScale: 1.0,
        amp: 0.12
      });
      
      // 2. Slow outer warning ring
      const ringGeom = new THREE.RingGeometry(0.9, 0.94, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf0b054,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      
      // 3. Yellow drifting particles
      const particleCount = 8;
      const sphereGeom = new THREE.SphereGeometry(0.06, 8, 8);
      const particleMat = new THREE.MeshBasicMaterial({ color: 0xf0b054 });
      for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(sphereGeom, particleMat);
        group.add(particle);
        elements.push({
          mesh: particle,
          type: 'float',
          phase: Math.random() * Math.PI * 2,
          amplitude: 0.2 + Math.random() * 0.3,
          speed: 0.8 + Math.random() * 0.8,
          basePos: new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 0.8
          )
        });
      }
      
      // 4. Central light
      const pLight = new THREE.PointLight(0xf0b054, 1.5, 6);
      pLight.position.set(0, 0, 0);
      group.add(pLight);
      
    } else if (type === 'severe') {
      // 1. Violent Red Core
      const coreGeom = new THREE.SphereGeometry(0.35, 32, 32);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xe65840,
        emissive: 0xe65840,
        emissiveIntensity: 2.5
      });
      const core = new THREE.Mesh(coreGeom, coreMat);
      group.add(core);
      elements.push({
        mesh: core,
        type: 'pulsate',
        speed: 6.0,
        baseScale: 1.0,
        amp: 0.2
      });
      
      // 2. High-speed red rings
      const ringGeom = new THREE.RingGeometry(0.9, 0.95, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xe65840,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      
      const ringX = new THREE.Mesh(ringGeom, ringMat);
      ringX.rotation.x = Math.PI / 2;
      group.add(ringX);
      
      const ringY = new THREE.Mesh(ringGeom, ringMat);
      ringY.rotation.y = Math.PI / 2;
      group.add(ringY);
      
      const ringZ = new THREE.Mesh(ringGeom, ringMat);
      group.add(ringZ);
      
      elements.push(
        { mesh: ringX, type: 'rotate', axis: 'x', speed: 4.5 },
        { mesh: ringY, type: 'rotate', axis: 'y', speed: -3.5 },
        { mesh: ringZ, type: 'rotate', axis: 'z', speed: 5.5 }
      );
      
      // 3. Spark lines (simulate electrical arcs connecting Left & Right molecules)
      const sparkCount = 3;
      const sparkMaterial = new THREE.LineBasicMaterial({ color: 0xe65840 });
      for (let i = 0; i < sparkCount; i++) {
        const points = [];
        for (let j = 0; j <= 5; j++) {
          const t = j / 5;
          const x = -1.5 + t * 3.0;
          const y = (Math.random() - 0.5) * 0.4;
          const z = (Math.random() - 0.5) * 0.4;
          points.push(new THREE.Vector3(x, y, z));
        }
        const sparkGeom = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(sparkGeom, sparkMaterial);
        group.add(line);
        elements.push({
          mesh: line,
          type: 'spark',
          pointsCount: 5,
          geom: sparkGeom
        });
      }
      
      // 4. Central red glowing PointLight
      const pLight = new THREE.PointLight(0xe65840, 3.5, 8);
      pLight.position.set(0, 0, 0);
      group.add(pLight);
    }
    
    reactorElementsRef.current = elements;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '300px' }}>
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%', cursor: 'grab' }}
        title="Drag to rotate, scroll to zoom"
      />
      
      {/* Zoom Controls Overlay */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '16px', 
          right: '16px', 
          display: 'flex', 
          flexDirection: 'column',
          gap: '6px',
          zIndex: 10
        }}
      >
        <button
          className="zoom-btn"
          onClick={zoomIn}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="zoom-btn"
          onClick={zoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      <div 
        className="glass-panel" 
        style={{ 
          position: 'absolute', 
          bottom: '16px', 
          left: '16px', 
          padding: '6px 12px', 
          borderRadius: 'var(--radius-sm)', 
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          userSelect: 'none',
          pointerEvents: 'none'
        }}
      >
        {moleculeData2 ? (
          <span>🧬 3D Space: {moleculeName} + {moleculeName2} (Interaction Mode)</span>
        ) : (
          <span>🧬 3D Compound: {moleculeName} (Drag to rotate)</span>
        )}
      </div>
    </div>
  );
}
