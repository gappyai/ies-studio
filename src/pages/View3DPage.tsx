import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useIESFileStore } from '../store/iesFileStore';
import { useMemo, useState } from 'react';
import * as THREE from 'three';

function LightDistribution({ data, verticalAngles, horizontalAngles }: { 
  data: number[][], 
  verticalAngles: number[],
  horizontalAngles: number[]
}) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    
    // Find max intensity for normalization
    let maxIntensity = 0;
    data.forEach(slice => {
      slice.forEach(val => {
        if (val > maxIntensity) maxIntensity = val;
      });
    });
    
    if (maxIntensity === 0) maxIntensity = 1; // Prevent division by zero
    
    // For IES Type C photometry:
    // - Vertical angles (gamma): 0° = nadir (down), 90° = horizon, 180° = zenith (up)
    // - Horizontal angles (C-plane): 0° to 360° around the vertical axis
    
    // Create vertices for spherical mesh
    const numHorizontal = horizontalAngles.length;
    const numVertical = verticalAngles.length;
    
    for (let hIdx = 0; hIdx < numHorizontal; hIdx++) {
      const horizontalSlice = data[hIdx] || [];
      const cAngle = horizontalAngles[hIdx]; // C-plane angle in degrees
      
      for (let vIdx = 0; vIdx < numVertical; vIdx++) {
        const intensity = horizontalSlice[vIdx] || 0;
        const gammaAngle = verticalAngles[vIdx]; // Vertical angle in degrees
        
        // Convert IES angles to spherical coordinates
        // In IES: gamma=0 is down, gamma=180 is up
        // We want: theta=0 at top (z-axis), increasing downward
        const theta = (gammaAngle * Math.PI) / 180; // Convert to radians
        const phi = (cAngle * Math.PI) / 180; // Convert to radians
        
        // Scale radius by normalized intensity (with minimum size for visibility)
        const normalizedIntensity = intensity / maxIntensity;
        const minRadius = 0.1; // Minimum radius for structure
        const r = minRadius + normalizedIntensity * 2; // Scale factor for visibility
        
        // Convert spherical to Cartesian (ISO convention: z-up)
        // x = r * sin(theta) * cos(phi)
        // y = r * sin(theta) * sin(phi)
        // z = r * cos(theta)
        const x = r * Math.sin(theta) * Math.cos(phi);
        const y = r * Math.sin(theta) * Math.sin(phi);
        const z = r * Math.cos(theta);
        
        vertices.push(x, y, z);
        
        // Create color gradient: green (low) -> yellow (medium) -> red (high)
        let r_color, g_color, b_color;
        
        if (normalizedIntensity < 0.5) {
          // Green to yellow (0.0 - 0.5)
          const t = normalizedIntensity * 2; // 0 to 1
          r_color = t;
          g_color = 0.8 + t * 0.2; // Start at dark green
          b_color = 0.1;
        } else {
          // Yellow to red (0.5 - 1.0)
          const t = (normalizedIntensity - 0.5) * 2; // 0 to 1
          r_color = 1;
          g_color = 1 - t;
          b_color = 0.1 * (1 - t);
        }
        
        colors.push(r_color, g_color, b_color);
      }
    }
    
    // Create triangle indices for mesh faces
    for (let hIdx = 0; hIdx < numHorizontal; hIdx++) {
      const nextH = (hIdx + 1) % numHorizontal; // Wrap around
      
      for (let vIdx = 0; vIdx < numVertical - 1; vIdx++) {
        const current = hIdx * numVertical + vIdx;
        const next = nextH * numVertical + vIdx;
        
        // Create two triangles for each quad
        // Triangle 1
        indices.push(current, next, current + 1);
        // Triangle 2
        indices.push(next, next + 1, current + 1);
      }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    return geo;
  }, [data, verticalAngles, horizontalAngles]);

  return (
    <mesh geometry={geometry}>
      <meshPhongMaterial 
        vertexColors 
        side={THREE.DoubleSide}
        shininess={100}
        transparent
        opacity={0.95}
        emissive={new THREE.Color(0x0a0a0a)}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

export function View3DPage() {
  const { currentFile } = useIESFileStore();
  const [viewPreset, setViewPreset] = useState<string>('default');

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No file loaded</p>
      </div>
    );
  }

  const cameraPositions: Record<string, [number, number, number]> = {
    default: [4, 4, 4],
    top: [0, 0, 6],
    'along-c0': [6, 0, 0],
    'along-c90': [0, 6, 0],
    'along-c180': [-6, 0, 0],
    'along-c270': [0, -6, 0],
    bottom: [0, 0, -6],
    dimetric: [5, 5, 5],
  };

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="p-6 border-b border-gray-800 bg-[#0f0f1e]">
        <h1 className="text-3xl font-bold text-white">3D Visualization</h1>
        <p className="text-gray-400 mt-1">Interactive photometric solid - light distribution in 3D space</p>
      </div>
      
      <div className="flex-1 bg-black relative">
        <Canvas key={viewPreset}>
          <PerspectiveCamera 
            makeDefault 
            position={cameraPositions[viewPreset] || cameraPositions.default}
            fov={50}
          />
          <OrbitControls 
            enableDamping 
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={20}
          />
          
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 10]} intensity={0.8} color="#ffffff" />
          <directionalLight position={[-10, -10, -10]} intensity={0.3} color="#4466ff" />
          <pointLight position={[0, 0, 0]} intensity={1} color="#ffe66d" distance={10} decay={2} />
          
          <LightDistribution 
            data={currentFile.photometricData.candelaValues}
            verticalAngles={currentFile.photometricData.verticalAngles}
            horizontalAngles={currentFile.photometricData.horizontalAngles}
          />
          
          {/* Coordinate axes (R=X, G=Y, B=Z) */}
          <primitive object={new THREE.AxesHelper(3)} />
          
          {/* Grid on XY plane */}
          <gridHelper args={[8, 16, '#333333', '#1a1a1a']} rotation={[0, 0, 0]} />
        </Canvas>
        
        {/* View preset buttons */}
        <div className="absolute top-6 left-6 space-y-2">
          <div className="grid grid-cols-2 gap-2 bg-black/80 p-4 rounded-lg backdrop-blur-sm">
            <button
              onClick={() => setViewPreset('default')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'default'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              DEFAULT VIEW
            </button>
            <button
              onClick={() => setViewPreset('top')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'top'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              TOP ALONG Z
            </button>
            <button
              onClick={() => setViewPreset('along-c0')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'along-c0'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              ALONG C0-C180
            </button>
            <button
              onClick={() => setViewPreset('along-c90')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'along-c90'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              ALONG C90-C270
            </button>
            <button
              onClick={() => setViewPreset('along-c180')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'along-c180'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              ALONG C180-C0
            </button>
            <button
              onClick={() => setViewPreset('along-c270')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'along-c270'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              ALONG C270-C90
            </button>
            <button
              onClick={() => setViewPreset('bottom')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'bottom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              BOTTOM ALONG Z
            </button>
            <button
              onClick={() => setViewPreset('dimetric')}
              className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
                viewPreset === 'dimetric'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              DIMETRIC
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-6 left-6 bg-black/80 text-white p-4 rounded-lg backdrop-blur-sm">
          <h3 className="font-semibold mb-2 text-sm">Controls</h3>
          <ul className="text-xs space-y-1 text-gray-300">
            <li>• Left click + drag: Rotate</li>
            <li>• Right click + drag: Pan</li>
            <li>• Scroll: Zoom in/out</li>
          </ul>
        </div>
        
        <div className="absolute top-6 right-6 bg-black/80 text-white p-4 rounded-lg backdrop-blur-sm">
          <h3 className="font-semibold mb-3 text-sm">Intensity Scale</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-3 bg-gradient-to-r from-green-600 to-yellow-400 rounded"></div>
              <span className="text-xs text-gray-300">Low → Medium</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-3 bg-gradient-to-r from-yellow-400 to-red-500 rounded"></div>
              <span className="text-xs text-gray-300">Medium → High</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              Peak Intensity:
            </p>
            <p className="text-white font-semibold">
              {currentFile.photometricData.candelaValues.flat().reduce((max, val) => Math.max(max, val), 0).toFixed(1)} cd
            </p>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            <p>Photometric Solid</p>
            <p className="text-gray-600">Type C Distribution</p>
          </div>
        </div>
      </div>
    </div>
  );
}