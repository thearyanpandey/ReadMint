/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

// Expanded color palette to match the vibrant Antigravity feel
const colorsList = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#8A2BE2', '#00BFFF'];

const AntigravityInner = ({ count = 3000 }) => {
  const meshRef = useRef(null);
  const { viewport } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  const globalMouse = useRef({ x: 0, y: 0 });

  const particles = useMemo(() => {
    const temp = [];
    // Ensure the field covers the whole screen even if resized
    const width = viewport.width * 2 || 100;
    const height = viewport.height * 2 || 100;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      const z = (Math.random() - 0.5) * 5; // Keep them closer to the camera focus

      const color = colorsList[Math.floor(Math.random() * colorsList.length)];

      // 1. SHAPE: Make them look like thin dashes instead of square dots
      const scaleX = Math.random() * 0.2 + 0.05; // Length
      const scaleY = Math.random() * 0.04 + 0.01; // Thickness
      const scaleZ = Math.random() * 0.04 + 0.01;

      // 2. ROTATION: Radiating outward - point them towards the center to create a burst
      const baseRotZ = Math.atan2(y, x);

      temp.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        cx: x,
        cy: y,
        scaleX, scaleY, scaleZ,
        color,
        baseRotZ
      });
    }
    return temp;
  }, [count, viewport.width, viewport.height]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      globalMouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      globalMouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (meshRef.current) {
      particles.forEach((p, i) => {
        colorObj.set(p.color);
        meshRef.current.setColorAt(i, colorObj);
      });
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles, colorObj]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { viewport: v } = state;

    const mouseX = (globalMouse.current.x * v.width) / 2;
    const mouseY = (globalMouse.current.y * v.height) / 2;

    // 3. PHYSICS: Create a proximity forcefield around the cursor
    const hoverRadius = 8; // Size of the invisible cursor shield
    const repelForce = 1.2; // How strongly it pushes them away

    particles.forEach((particle, i) => {
      let targetX = particle.baseX;
      let targetY = particle.baseY;

      const dx = particle.baseX - mouseX;
      const dy = particle.baseY - mouseY;
      const distToMouse = Math.sqrt(dx * dx + dy * dy);

      // If the mouse gets too close, calculate a push vector away from the mouse
      if (distToMouse < hoverRadius) {
        const force = (hoverRadius - distToMouse) * repelForce;
        const angle = Math.atan2(dy, dx);
        
        targetX += Math.cos(angle) * force;
        targetY += Math.sin(angle) * force;
      }

      // Smooth spring logic to snap them back into their original places
      particle.cx += (targetX - particle.cx) * 0.15;
      particle.cy += (targetY - particle.cy) * 0.15;

      dummy.position.set(particle.cx, particle.cy, particle.baseZ);
      dummy.rotation.set(0, 0, particle.baseRotZ);
      dummy.scale.set(particle.scaleX, particle.scaleY, particle.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {/* A simple box geometry, which we stretched into dashes via scaling */}
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
};

const Antigravity = props => {
  return (
    <Canvas camera={{ position: [0, 0, 50], fov: 35 }}>
      <AntigravityInner {...props} />
    </Canvas>
  );
};

export default Antigravity;