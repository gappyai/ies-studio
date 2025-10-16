import { useState } from 'react';
import { photometricCalculator } from '../../services/calculator';
import type { PhotometricData } from '../../types/ies.types';

interface PhotometricScalingPanelProps {
  currentPhotometricData: PhotometricData;
  onPhotometricUpdate: (key: keyof PhotometricData, value: any) => void;
  onBulkUpdate: (updates: Partial<PhotometricData>) => void;
}

export function PhotometricScalingPanel({
  currentPhotometricData,
  onPhotometricUpdate,
  onBulkUpdate
}: PhotometricScalingPanelProps) {
  const [cctMultiplier, setCctMultiplier] = useState<string>('1.0');
  const [targetWattage, setTargetWattage] = useState<string>('');
  const [targetLength, setTargetLength] = useState<string>('');
  const [lengthUnit, setLengthUnit] = useState<'mm' | 'feet'>('mm');

  const handleCCTScale = () => {
    const multiplier = parseFloat(cctMultiplier);
    if (isNaN(multiplier) || multiplier <= 0) {
      alert('Please enter a valid CCT multiplier');
      return;
    }
    
    const result = photometricCalculator.scaleByCCT(currentPhotometricData, multiplier);
    onBulkUpdate(result.scaledPhotometricData);
    
    alert(`CCT scaling applied with multiplier ${multiplier}\nNew lumens: ${result.scaledPhotometricData.totalLumens.toFixed(1)} lm`);
  };

  const handleWattageScale = () => {
    const newWattage = parseFloat(targetWattage);
    if (isNaN(newWattage) || newWattage <= 0) {
      alert('Please enter a valid wattage value');
      return;
    }
    
    const result = photometricCalculator.scaleByWattage(currentPhotometricData, newWattage);
    onBulkUpdate(result.scaledPhotometricData);
    
    alert(`Wattage updated to ${newWattage}W\nNew lumens: ${result.scaledPhotometricData.totalLumens.toFixed(1)} lm\nEfficacy: ${photometricCalculator.calculateEfficacy(result.scaledPhotometricData.totalLumens, newWattage).toFixed(1)} lm/W`);
  };

  const handleLengthScale = () => {
    const newLength = parseFloat(targetLength);
    if (isNaN(newLength) || newLength <= 0) {
      alert('Please enter a valid length value');
      return;
    }
    
    // Check if fixture is linear
    if (!photometricCalculator.isLinearFixture(currentPhotometricData)) {
      if (!confirm('This fixture may not be linear. Length scaling is most accurate for linear fixtures. Continue?')) {
        return;
      }
    }
    
    const result = photometricCalculator.scaleByLength(
      currentPhotometricData, 
      newLength, 
      currentPhotometricData.unitsType
    );
    onBulkUpdate(result.scaledPhotometricData);
    
    alert(`Length updated to ${newLength}${lengthUnit}\nNew wattage: ${result.scaledPhotometricData.inputWatts.toFixed(1)}W\nNew lumens: ${result.scaledPhotometricData.totalLumens.toFixed(1)} lm`);
  };

  const setStandardLength = (lengthMm: number) => {
    setTargetLength(lengthMm.toString());
    setLengthUnit('mm');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Photometric Scaling</h2>
      <p className="text-sm text-gray-600 mb-4">Scale photometric values based on CCT, wattage, or length changes</p>
      
      <div className="space-y-6">
        {/* CCT Scaling */}
        <div className="border-b pb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">CCT Multiplier (Type 2)</h3>
          <p className="text-xs text-gray-600 mb-2">Apply CCT-based lumen multiplier</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={cctMultiplier}
              onChange={(e) => setCctMultiplier(e.target.value)}
              placeholder="1.0"
              step="0.01"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={handleCCTScale}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Apply CCT
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Example: 0.92 for 3000K, 1.05 for 5000K
          </p>
        </div>

        {/* Wattage Scaling */}
        <div className="border-b pb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Update Wattage (Type 3)</h3>
          <p className="text-xs text-gray-600 mb-2">Change wattage with proportional photometric scaling</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={targetWattage}
              onChange={(e) => setTargetWattage(e.target.value)}
              placeholder={`Current: ${currentPhotometricData.inputWatts.toFixed(1)}W`}
              step="0.1"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={handleWattageScale}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Apply Wattage
            </button>
          </div>
        </div>

        {/* Length Scaling */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Update Length (Type 4)</h3>
          <p className="text-xs text-gray-600 mb-2">For linear fixtures only - scales wattage and lumens proportionally</p>
          
          {/* Quick buttons for standard lengths */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setStandardLength(100)}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              100mm
            </button>
            <button
              onClick={() => setStandardLength(304.8)}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              1 Foot
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="number"
              value={targetLength}
              onChange={(e) => setTargetLength(e.target.value)}
              placeholder="Enter length"
              step="1"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <select
              value={lengthUnit}
              onChange={(e) => setLengthUnit(e.target.value as 'mm' | 'feet')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="mm">mm</option>
              <option value="feet">feet</option>
            </select>
            <button
              onClick={handleLengthScale}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Apply Length
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}