import type { PhotometricData } from '../../types/ies.types';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface View3DTabProps {
  photometricData: PhotometricData;
}

export function View3DTab({ photometricData }: View3DTabProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">3D Light Distribution</h2>
      <div style={{ height: '600px' }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[5, 5, 5]} />
          <OrbitControls enableDamping dampingFactor={0.05} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <LightDistribution photometricData={photometricData} />
          <gridHelper args={[10, 10]} />
          <axesHelper args={[5]} />
        </Canvas>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Controls:</strong> Left click + drag to rotate, Right click + drag to pan, Scroll to zoom</p>
      </div>
    </div>
  );
}

// 3D Light Distribution Component
function LightDistribution({ photometricData }: { photometricData: PhotometricData }) {
  const { verticalAngles, horizontalAngles, candelaValues } = photometricData;
  
  // Create geometry from candela data
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const colors: number[] = [];
  
  // Find max candela for normalization
  const maxCandela = Math.max(...candelaValues.flat());
  
  // Generate vertices for each angle combination
  for (let h = 0; h < horizontalAngles.length; h++) {
    for (let v = 0; v < verticalAngles.length; v++) {
      const horizontalAngle = (horizontalAngles[h] * Math.PI) / 180;
      const verticalAngle = (verticalAngles[v] * Math.PI) / 180;
      const candela = candelaValues[h][v];
      const normalizedIntensity = candela / maxCandela;
      
      // Convert spherical to cartesian coordinates
      const radius = normalizedIntensity * 2; // Scale for visibility
      const x = radius * Math.sin(verticalAngle) * Math.cos(horizontalAngle);
      const y = radius * Math.cos(verticalAngle);
      const z = radius * Math.sin(verticalAngle) * Math.sin(horizontalAngle);
      
      vertices.push(x, y, z);
      
      // Color based on intensity (blue to red gradient)
      const r = normalizedIntensity;
      const g = 0.3;
      const b = 1 - normalizedIntensity;
      colors.push(r, g, b);
    }
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.05} vertexColors />
    </points>
  );
}