import { useIESFileStore } from '../store/iesFileStore';
import { photometricCalculator } from '../services/calculator';
import type { PhotometricData } from '../types/ies.types';

interface PhotometricUpdateParams {
  fileId: string;
  originalWattage?: number;
  originalLumens?: number;
  newWattage?: number;
  newLumens?: number;
  autoAdjustWattage?: boolean;
}

/**
 * Unified function to apply wattage and lumens updates consistently
 * This ensures CSV and UI updates produce the same results
 */
export function applyPhotometricUpdates(
  photometricData: PhotometricData,
  params: PhotometricUpdateParams
): PhotometricData {
  const { newWattage, newLumens, autoAdjustWattage = false } = params;
  
  let updatedData = { ...photometricData };
  
  // Check if wattage needs update (compare with current data to allow reverting)
  // We prioritize the new value if it's provided and valid
  const shouldUpdateWattage = newWattage !== undefined && !isNaN(newWattage) && newWattage > 0 &&
    Math.abs(newWattage - updatedData.inputWatts) > 0.001;
  
  // Apply wattage change first (auto-adjusts lumens and candela)
  if (shouldUpdateWattage) {
    const result = photometricCalculator.scaleByWattage(updatedData, newWattage);
    updatedData = result.scaledPhotometricData;
  }
  
  // Check if lumens needs update
  // We prioritize the new value if it's provided, valid, and different from the (possibly scaled) current data
  const shouldUpdateLumens = newLumens !== undefined && !isNaN(newLumens) && newLumens > 0 &&
    Math.abs(newLumens - updatedData.totalLumens) > 0.1;

  // Apply lumens change second (only if it was explicitly changed and differs from current)
  // This allows overriding the auto-adjusted lumens from wattage change
  if (shouldUpdateLumens) {
    const result = photometricCalculator.scaleByLumens(
      updatedData,
      newLumens,
      autoAdjustWattage
    );
    updatedData = result.scaledPhotometricData;
  }
  
  return updatedData;
}

/**
 * Hook to manage photometric updates for batch files
 */
export function usePhotometricUpdates() {
  const { batchFiles, addBatchFiles } = useIESFileStore();
  
  const updateFilePhotometricData = (
    fileId: string,
    params: PhotometricUpdateParams
  ): { updatedData: PhotometricData; finalWattage: number; finalLumens: number } | null => {
    const file = batchFiles.find(f => f.id === fileId);
    if (!file) return null;
    
    const updatedData = applyPhotometricUpdates(file.photometricData, params);
    
    // Update the batch file in the store
    const updatedFiles = batchFiles.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          photometricData: updatedData
        };
      }
      return f;
    });
    addBatchFiles(updatedFiles);
    
    return {
      updatedData,
      finalWattage: updatedData.inputWatts,
      finalLumens: updatedData.totalLumens
    };
  };
  
  return { updateFilePhotometricData };
}

