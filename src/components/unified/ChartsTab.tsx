import { useState } from 'react';
import type { PhotometricData } from '../../types/ies.types';
import { PolarChart } from '../charts/PolarChart';
import { LinearChart } from '../charts/LinearChart';
import { IsoCandelaChart } from '../charts/IsoCandelaChart';
import { IsoIlluminanceChart } from '../charts/IsoIlluminanceChart';

interface ChartsTabProps {
  photometricData: PhotometricData;
}

export function ChartsTab({ photometricData }: ChartsTabProps) {
  const [viewPreset, setViewPreset] = useState<string>('default');

  return (
    <div className="space-y-6">
      {/* View Preset Selector */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chart Preset
        </label>
        <select
          value={viewPreset}
          onChange={(e) => setViewPreset(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="default">All Charts</option>
          <option value="polar">Polar Charts Only</option>
          <option value="linear">Linear Charts Only</option>
          <option value="iso">Iso Charts Only</option>
        </select>
      </div>

      {/* Polar Charts */}
      {(viewPreset === 'default' || viewPreset === 'polar') && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Polar Distribution</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Vertical Plane (0°-180°)</h3>
              <PolarChart
                data={photometricData.candelaValues}
                verticalAngles={photometricData.verticalAngles}
                horizontalAngles={photometricData.horizontalAngles}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Horizontal Plane (90°)</h3>
              <PolarChart
                data={photometricData.candelaValues}
                verticalAngles={photometricData.verticalAngles}
                horizontalAngles={photometricData.horizontalAngles}
              />
            </div>
          </div>
        </div>
      )}

      {/* Linear Charts */}
      {(viewPreset === 'default' || viewPreset === 'linear') && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Linear Distribution</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Vertical Distribution</h3>
              <LinearChart
                data={photometricData.candelaValues}
                verticalAngles={photometricData.verticalAngles}
                horizontalAngles={photometricData.horizontalAngles}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Horizontal Distribution</h3>
              <LinearChart
                data={photometricData.candelaValues}
                verticalAngles={photometricData.verticalAngles}
                horizontalAngles={photometricData.horizontalAngles}
              />
            </div>
          </div>
        </div>
      )}

      {/* Iso Charts */}
      {(viewPreset === 'default' || viewPreset === 'iso') && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Iso Contour Charts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Iso-Candela</h3>
              <IsoCandelaChart
                data={photometricData.candelaValues}
                verticalAngles={photometricData.verticalAngles}
                horizontalAngles={photometricData.horizontalAngles}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Iso-Illuminance (at 1m)</h3>
              <IsoIlluminanceChart
                data={photometricData.candelaValues}
                verticalAngles={photometricData.verticalAngles}
                horizontalAngles={photometricData.horizontalAngles}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}