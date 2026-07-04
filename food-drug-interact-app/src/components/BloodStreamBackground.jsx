import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function BloodStreamBackground() {
  const containerRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    
    // Deep biological fog to create depth (like looking into plasma)
    scene.fog = new THREE.FogExp2(0x070504, 0.12);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 15;

    // 2. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Lighting (Hematogenix crimson/teal aesthetic)
    const ambientLight = new THREE.AmbientLight(0x221111, 0.6); // Warm reddish ambient
    scene.add(ambientLight);

    const redLight = new THREE.DirectionalLight(0xd63c37, 2.5); // Intense crimson light
    redLight.position.set(5, 5, 10);
    scene.add(redLight);

    const blueLight = new THREE.DirectionalLight(0x4386e6, 1.2); // Supporting cold blue light
    blueLight.position.set(-10, -5, 5);
    scene.add(blueLight);

    const pointLight = new THREE.PointLight(0xff7777, 1.5, 30);
    pointLight.position.set(0, 0, 8);
    scene.add(pointLight);

    // 4. Object Pools
    const particles = [];
    
    // Materials
    // Glossy Red Blood Cell material
    const rbcMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x900d09,
      roughness: 0.15,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.8,
      sheen: 1.0,
      sheenColor: 0xd63c37
    });

    // Drug Capsules (Two-tone: half crimson, half white)
    const capsuleMaterials = {
      red: new THREE.MeshPhysicalMaterial({
        color: 0xd63c37,
        roughness: 0.2,
        clearcoat: 0.8,
        reflectivity: 0.6
      }),
      white: new THREE.MeshPhysicalMaterial({
        color: 0xf0edea,
        roughness: 0.2,
        clearcoat: 0.8,
        reflectivity: 0.6
      })
    };

    // Plasma Glowing sphere material
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xd63c37,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });

    // Helper: Create 3D biconcave Red Blood Cell mesh
    const createRedBloodCell = () => {
      const cellGroup = new THREE.Group();
      
      // We model the torus rim
      const torusGeo = new THREE.TorusGeometry(1.0, 0.45, 16, 64);
      const rim = new THREE.Mesh(torusGeo, rbcMaterial);
      cellGroup.add(rim);
      
      // We model the flat center membrane
      const cylinderGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 32);
      const center = new THREE.Mesh(cylinderGeo, rbcMaterial);
      center.rotation.x = Math.PI / 2;
      cellGroup.add(center);
      
      return cellGroup;
    };

    // Helper: Create 3D Pill Capsule mesh
    const createPillCapsule = () => {
      const pillGroup = new THREE.Group();

      // Top Half (Crimson Red)
      const topGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16, 1, false);
      const topCapGeo = new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      
      const topMesh = new THREE.Mesh(topGeo, capsuleMaterials.red);
      const topCapMesh = new THREE.Mesh(topCapGeo, capsuleMaterials.red);
      
      topMesh.position.y = 0.3;
      topCapMesh.position.y = 0.6;
      
      pillGroup.add(topMesh);
      pillGroup.add(topCapMesh);

      // Bottom Half (White)
      const bottomGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16, 1, false);
      const bottomCapGeo = new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      
      const bottomMesh = new THREE.Mesh(bottomGeo, capsuleMaterials.white);
      const bottomCapMesh = new THREE.Mesh(bottomCapGeo, capsuleMaterials.white);
      
      bottomMesh.position.y = -0.3;
      bottomCapMesh.position.y = -0.6;
      
      pillGroup.add(bottomMesh);
      pillGroup.add(bottomCapMesh);

      return pillGroup;
    };

    // Instantiate 3D backdrop pool
    const numObjects = 28;
    for (let i = 0; i < numObjects; i++) {
      let mesh;
      const typeRand = Math.random();
      
      if (typeRand < 0.6) {
        // Red Blood Cells
        mesh = createRedBloodCell();
        mesh.scale.setScalar(0.5 + Math.random() * 0.7);
      } else if (typeRand < 0.85) {
        // Capsules
        mesh = createPillCapsule();
        mesh.scale.setScalar(0.7 + Math.random() * 0.6);
      } else {
        // Large Glowing Plasma Protein
        const glowGeo = new THREE.SphereGeometry(1.5 + Math.random() * 1.5, 16, 16);
        mesh = new THREE.Mesh(glowGeo, glowMaterial);
      }

      // Random 3D placements (covering broad Z space for depth)
      mesh.position.set(
        (Math.random() - 0.5) * 30, // X
        (Math.random() - 0.5) * 20, // Y
        (Math.random() - 0.5) * 18 - 2 // Z
      );

      // Save velocities
      mesh.userData = {
        speedX: -0.008 - Math.random() * 0.012, // Slowly drift left
        speedY: -0.006 - Math.random() * 0.01,   // Slowly drift up/down
        rotX: (Math.random() - 0.5) * 0.015,
        rotY: (Math.random() - 0.5) * 0.015,
        rotZ: (Math.random() - 0.5) * 0.01
      };

      scene.add(mesh);
      particles.push(mesh);
    }

    // 5. Window Resize Listener
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 6. Mouse Listener for Parallax
    const handleMouseMove = (e) => {
      mouse.current.targetX = (e.clientX / window.innerWidth) - 0.5;
      mouse.current.targetY = (e.clientY / window.innerHeight) - 0.5;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 7. Animation Loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Smooth mouse coordinate interpolation
      mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.05;
      mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.05;

      // Parallax effect on camera angle
      camera.position.x += (mouse.current.x * 5 - camera.position.x) * 0.05;
      camera.position.y += (-mouse.current.y * 5 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, -2);

      // Update particles
      particles.forEach((p) => {
        p.position.x += p.userData.speedX;
        p.position.y += p.userData.speedY;
        
        p.rotation.x += p.userData.rotX;
        p.rotation.y += p.userData.rotY;
        p.rotation.z += p.userData.rotZ;

        // Wrap around boundaries
        if (p.position.x < -18) p.position.x = 18;
        if (p.position.y < -12) p.position.y = 12;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
      if (renderer && renderer.domElement && container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -2,
        pointerEvents: 'none',
        display: 'block'
      }}
    />
  );
}


