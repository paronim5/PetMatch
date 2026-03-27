import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function CatModel({ scrollProgress, isMobile, catPath }) {
  const catRef = useRef();
  const mixerRef = useRef();
  const { scene, animations } = useGLTF('/cat.glb');
  const { start, end } = catPath;

  useEffect(() => {
    if (animations && animations.length > 0 && scene) {
      mixerRef.current = new THREE.AnimationMixer(scene);
    }
    return () => {
      if (mixerRef.current) mixerRef.current.stopAllAction();
    };
  }, [scene, animations]);

  useFrame(() => {
    if (mixerRef.current && animations && animations.length > 0) {
      const action = mixerRef.current.clipAction(animations[0]);
      const duration = action.getClip().duration;
      const totalTime = scrollProgress * duration * 2.0;
      const time = totalTime % duration;
      action.time = time;
      action.play();
      mixerRef.current.setTime(time);
    }
    if (catRef.current) {
      catRef.current.position.lerpVectors(start, end, scrollProgress);
    }
  });

  return (
    <primitive
      ref={catRef}
      object={scene}
      scale={isMobile ? 7 : 5}
      rotation={[0, -Math.PI / 2, 0]}
    />
  );
}

function CatScene({ scrollProgress, isMobile, catPath, cameraPos, fov }) {
  return (
    <Canvas
      camera={{ position: cameraPos, fov }}
      shadows
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />
      <CatModel scrollProgress={scrollProgress} isMobile={isMobile} catPath={catPath} />
    </Canvas>
  );
}

export default CatScene;
