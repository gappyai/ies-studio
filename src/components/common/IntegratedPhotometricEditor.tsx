import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { photometricCalculator } from '../../services/calculator';
import type { PhotometricData } from '../../types/ies.types';

interface IntegratedPhotometricEditorProps {
  currentPhotometricData: PhotometricData;
  onPhotometricUpdate: (key: keyof PhotometricData, value: any) => void;
  onBulkUpdate: (updates: Partial<PhotometricData>) => void;
  onCCTUpdate: (cct: number) => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export function IntegratedPhotometricEditor({
  currentPhotometricData,
  onPhotometricUpdate,
  onBulkUpdate,
  onCCTUpdate,
  onToast
}: IntegratedPhotometricEditorProps) {
  const [cctValue, setCctValue] = useState('');
  const [cctMultiplier, setCctMultiplier] = useState('1.0');
  const [wattageValue, setWattageValue] = useState(currentPhotometricData.inputWatts.toFixed(1));
  const [lumensValue, setLumensValue] = useState(currentPhotometricData.totalLumens.toFixed(0));
  const [autoAdjustWattage, setAutoAdjustWattage] = useState(false);
  const [lengthValue, setLengthValue] = useState('');
  const [useImperial, setUseImperial] = useState(false); // Toggle between meters and feet

  // Determine longest dimension and which field it is
  const longestDimension = Math.max(
    currentPhotometricData.width,
    currentPhotometricData.length,
    currentPhotometricData.height
  );
  
  // Properly determine which dimension is longest
  const longestDimensionName: 'length' | 'width' | 'height' =
    longestDimension === currentPhotometricData.length ? 'length' :
    longestDimension === currentPhotometricData.width ? 'width' : 'height';
    
  const isLinear = photometricCalculator.isLinearFixture(currentPhotometricData);
  
  // Conversion helpers
  const metersToFeet = (meters: number) => meters * 3.28084;
  const feetToMeters = (feet: number) => feet / 3.28084;
  
  // Display values based on unit toggle
  const getDisplayValue = (meters: number) => useImperial ? metersToFeet(meters).toFixed(4) : meters.toFixed(4);
  const parseInputValue = (value: string) => {
    const num = parseFloat(value);
    return useImperial ? feetToMeters(num) : num;
  };

  const handleCCTApply = () => {
    const cct = parseFloat(cctValue);
    const multiplier = parseFloat(cctMultiplier);
    
    if (isNaN(cct) || cct <= 0) {
      onToast?.('Please enter a valid CCT value', 'error');
      return;
    }
    
    onCCTUpdate(cct);
    
    if (!isNaN(multiplier) && multiplier > 0 && Math.abs(multiplier - 1.0) > 0.001) {
      const result = photometricCalculator.scaleByCCT(currentPhotometricData, multiplier);
      onBulkUpdate(result.scaledPhotometricData);
      onToast?.(`CCT updated to ${cct}K with multiplier ${multiplier} • New lumens: ${result.scaledPhotometricData.totalLumens.toFixed(1)} lm`, 'success');
    } else {
      onToast?.(`CCT updated to ${cct}K`, 'success');
    }
  };

  const handleWattageApply = () => {
    const newWattage = parseFloat(wattageValue);
    if (isNaN(newWattage) || newWattage <= 0) {
      onToast?.('Please enter a valid wattage value', 'error');
      return;
    }
    
    const result = photometricCalculator.scaleByWattage(currentPhotometricData, newWattage);
    onBulkUpdate(result.scaledPhotometricData);
    
    const efficacy = photometricCalculator.calculateEfficacy(result.scaledPhotometricData.totalLumens, newWattage);
    onToast?.(`Wattage updated to ${newWattage}W • ${result.scaledPhotometricData.totalLumens.toFixed(1)} lm • ${efficacy.toFixed(1)} lm/W`, 'success');
  };

  const handleLumensApply = () => {
    const newLumens = parseFloat(lumensValue);
    if (isNaN(newLumens) || newLumens <= 0) {
      onToast?.('Please enter a valid lumens value', 'error');
      return;
    }
    
    const result = photometricCalculator.scaleByLumens(currentPhotometricData, newLumens, autoAdjustWattage);
    onBulkUpdate(result.scaledPhotometricData);
    
    // Update wattage value in UI if it was adjusted
    if (autoAdjustWattage) {
      setWattageValue(result.scaledPhotometricData.inputWatts.toFixed(1));
    }
    
    const efficacy = photometricCalculator.calculateEfficacy(newLumens, result.scaledPhotometricData.inputWatts);
    const message = autoAdjustWattage
      ? `Lumens updated to ${newLumens.toFixed(1)} lm • ${result.scaledPhotometricData.inputWatts.toFixed(1)}W • ${efficacy.toFixed(1)} lm/W`
      : `Lumens updated to ${newLumens.toFixed(1)} lm • Efficacy: ${efficacy.toFixed(1)} lm/W`;
    onToast?.(message, 'success');
  };

  const handleLengthScale = () => {
    const inputValue = parseFloat(lengthValue);
    if (isNaN(inputValue) || inputValue <= 0) {
      onToast?.(`Please enter a valid length value in ${useImperial ? 'feet' : 'meters'}`, 'error');
      return;
    }
    
    // Convert input to meters
    const newLengthMeters = useImperial ? feetToMeters(inputValue) : inputValue;
    
    if (!isLinear) {
      onToast?.('Warning: This fixture may not be linear. Length scaling is most accurate for linear fixtures.', 'info');
    }
    
    // Scale based on longest dimension using the new scaleByDimension function
    const result = photometricCalculator.scaleByDimension(
      currentPhotometricData,
      newLengthMeters, // Already in meters
      longestDimensionName
    );
    onBulkUpdate(result.scaledPhotometricData);
    
    // Update the wattage value in the UI
    setWattageValue(result.scaledPhotometricData.inputWatts.toFixed(1));
    
    const displayUnit = useImperial ? 'ft' : 'm';
    const displayValue = useImperial ? inputValue : newLengthMeters;
    onToast?.(`${longestDimensionName} scaled to ${displayValue.toFixed(3)} ${displayUnit} (${result.scalingFactor.toFixed(2)}×) • ${result.scaledPhotometricData.inputWatts.toFixed(1)}W • ${result.scaledPhotometricData.totalLumens.toFixed(1)} lm`, 'success');
  };

  const handleDimensionSwap = () => {
    const swapped = photometricCalculator.swapDimensions(currentPhotometricData);
    onPhotometricUpdate('width', swapped.width);
    onPhotometricUpdate('length', swapped.length);
    onToast?.('Width and length dimensions swapped', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Dimensions with Scaling */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Luminous Dimensions</h2>
            <p className="text-sm text-gray-600">The size of the light-emitting area</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={!useImperial ? 'font-semibold text-blue-600' : 'text-gray-600'}>Meters</span>
            <button
              onClick={() => setUseImperial(!useImperial)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useImperial ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useImperial ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={useImperial ? 'font-semibold text-blue-600' : 'text-gray-600'}>Feet</span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Width ({useImperial ? 'ft' : 'm'})
              </label>
              <input
                type="number"
                value={getDisplayValue(currentPhotometricData.width)}
                onChange={(e) => onPhotometricUpdate('width', parseInputValue(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                step={useImperial ? '0.01' : '0.001'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Length ({useImperial ? 'ft' : 'm'})
              </label>
              <input
                type="number"
                value={getDisplayValue(currentPhotometricData.length)}
                onChange={(e) => onPhotometricUpdate('length', parseInputValue(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                step={useImperial ? '0.01' : '0.001'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height ({useImperial ? 'ft' : 'm'})
              </label>
              <input
                type="number"
                value={getDisplayValue(currentPhotometricData.height)}
                onChange={(e) => onPhotometricUpdate('height', parseInputValue(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                step={useImperial ? '0.01' : '0.001'}
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Scale by Longest Dimension{isLinear ? ' (Linear Fixture)' : ''}
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              Current longest: {longestDimensionName} = {getDisplayValue(longestDimension)} {useImperial ? 'ft' : 'm'}
            </p>
            
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => { setLengthValue(useImperial ? '0.328' : '0.1'); }}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                {useImperial ? '0.328 ft (100mm)' : '0.1 m (100mm)'}
              </button>
              <button
                onClick={() => { setLengthValue(useImperial ? '1' : '0.3048'); }}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                1 Foot
              </button>
            </div>
            
            <div className="flex gap-2">
              <input
                type="number"
                value={lengthValue}
                onChange={(e) => setLengthValue(e.target.value)}
                placeholder={`Enter length in ${useImperial ? 'feet' : 'meters'}`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                step={useImperial ? '0.01' : '0.001'}
              />
              <button
                onClick={handleLengthScale}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Scale
              </button>
            </div>
          </div>

          <button
            onClick={handleDimensionSwap}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap Width ↔ Length
          </button>
        </div>
      </div>

      {/* CCT with Multiplier */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Color Temperature</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CCT (Kelvin)</label>
              <input
                type="number"
                value={cctValue}
                onChange={(e) => setCctValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="e.g., 4000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Multiplier (optional)
              </label>
              <input
                type="number"
                value={cctMultiplier}
                onChange={(e) => setCctMultiplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                step="0.01"
                placeholder="1.0"
              />
            </div>
          </div>
          
          <p className="text-xs text-gray-600">
            Multiplier adjusts lumens for different CCTs (e.g., 0.92 for 3000K, 1.05 for 5000K). Leave at 1.0 to only update CCT metadata.
          </p>
          
          <button
            onClick={handleCCTApply}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply CCT
          </button>
        </div>
      </div>

      {/* Wattage */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Power Consumption</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wattage (W)</label>
            <input
              type="number"
              value={wattageValue}
              onChange={(e) => setWattageValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              step="0.1"
              placeholder={`Current: ${currentPhotometricData.inputWatts.toFixed(1)}W`}
            />
          </div>
          
          <p className="text-xs text-gray-600">
            Scales lumens and candela proportionally, maintaining constant efficacy
          </p>
          
          <button
            onClick={handleWattageApply}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply Wattage
          </button>
        </div>
      </div>

      {/* Lumens with Auto-Adjust Wattage */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Total Lumens</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Lumens (lm)</label>
            <input
              type="number"
              value={lumensValue}
              onChange={(e) => setLumensValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              step="1"
              placeholder={`Current: ${currentPhotometricData.totalLumens.toFixed(0)} lm`}
            />
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="autoAdjustWattage"
              checked={autoAdjustWattage}
              onChange={(e) => setAutoAdjustWattage(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="autoAdjustWattage" className="text-sm text-gray-700 cursor-pointer">
              Auto-adjust wattage to maintain efficacy
            </label>
          </div>
          
          <p className="text-xs text-gray-600">
            {autoAdjustWattage
              ? 'Candela values and wattage will be scaled proportionally to maintain the same efficacy (lm/W)'
              : 'Only candela values will be scaled. Wattage remains unchanged, resulting in different efficacy'}
          </p>
          
          <button
            onClick={handleLumensApply}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply Lumens
          </button>
        </div>
      </div>
    </div>
  );
}