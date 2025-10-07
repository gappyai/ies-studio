import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useIESFileStore } from '../store/iesFileStore';
import { useMemo } from 'react';

function LightDistribution({ data }: { data: number[][] }) {
  const geometry = useMemo(() => {
    const points: [number, number, number][] = [];
    const colors: number[] = [];
    
    // Convert candela values to 3D points
    data.forEach((horizontalSlice, hIndex) => {
      horizontalSlice.forEach((intensity, vIndex) => {
        const theta = (vIndex / horizontalSlice.length) * Math.PI;
        const phi = (hIndex / data.length) * 2 * Math.PI;
        
        const r = intensity / 100; // Scale for visualization
        const x = r * Math.sin(theta) * Math.cos(phi);
        const y = r * Math.cos(theta);
        const z = r * Math.sin(theta) * Math.sin(phi);
        
        points.push([x, y, z]);
        
        // Color based on intensity (blue to red)
        const normalized = intensity / Math.max(...horizontalSlice);
        colors.push(normalized, 0, 1 - normalized);
      });
    });
    
    return { points, colors };
  }, [data]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={geometry.points.length}
          array={new Float32Array(geometry.points.flat())}
          itemSize={3}
          args={[new Float32Array(geometry.points.flat()), 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={geometry.colors.length / 3}
          array={new Float32Array(geometry.colors)}
          itemSize={3}
          args={[new Float32Array(geometry.colors), 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} vertexColors />
    </points>
  );
}

export function View3DPage() {
  const { currentFile } = useIESFileStore();

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No file loaded</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-200 bg-white">
        <h1 className="text-3xl font-bold text-gray-900">3D Visualization</h1>
        <p className="text-gray-600 mt-1">Interactive 3D light distribution model</p>
      </div>
      
      <div className="flex-1 bg-gray-900 relative">
        <Canvas>
          <PerspectiveCamera makeDefault position={[5, 5, 5]} />
          <OrbitControls enableDamping dampingFactor={0.05} />
          
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          
          <LightDistribution data={currentFile.photometricData.candelaValues} />
          
          {/* Grid helper */}
          <gridHelper args={[10, 10, '#444444', '#222222']} />
          
          {/* Axes helper */}
          <axesHelper args={[3]} />
        </Canvas>
        
        <div className="absolute bottom-6 left-6 bg-black/70 text-white p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Controls</h3>
          <ul className="text-sm space-y-1">
            <li>• Left click + drag: Rotate</li>
            <li>• Right click + drag: Pan</li>
            <li>• Scroll: Zoom</li>
          </ul>
        </div>
        
        <div className="absolute top-6 right-6 bg-black/70 text-white p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Legend</h3>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 bg-blue-500"></div>
            <span>Low intensity</span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-1">
            <div className="w-4 h-4 bg-red-500"></div>
            <span>High intensity</span>
          </div>
        </div>
      </div>
    </div>
  );
}