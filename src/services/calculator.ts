import type { PhotometricData, CalculatedProperties } from '../types/ies.types';

export interface ScalingResult {
  scaledPhotometricData: PhotometricData;
  scalingFactor: number;
}

/**
 * Helper function to truncate numbers to 3 decimal places
 */
function truncateToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export class PhotometricCalculator {
  /**
   * Scale photometric data by CCT multiplier (Type 2)
   */
  scaleByCCT(data: PhotometricData, cctMultiplier: number): ScalingResult {
    const scaled = { ...data };
    
    // Scale lumens per lamp
    scaled.lumensPerLamp = truncateToThreeDecimals(data.lumensPerLamp * cctMultiplier);
    scaled.totalLumens = truncateToThreeDecimals(scaled.lumensPerLamp * scaled.numberOfLamps);
    
    // Scale candela values proportionally
    scaled.candelaValues = data.candelaValues.map(
      horizontalSlice => horizontalSlice.map(value => truncateToThreeDecimals(value * cctMultiplier))
    );
    
    return {
      scaledPhotometricData: scaled,
      scalingFactor: truncateToThreeDecimals(cctMultiplier)
    };
  }

  /**
   * Scale photometric data by wattage change (Type 3)
   * Assumes constant efficacy
   */
  scaleByWattage(data: PhotometricData, newWattage: number): ScalingResult {
    const wattageRatio = truncateToThreeDecimals(newWattage / data.inputWatts);
    const scaled = { ...data };
    
    // Scale lumens proportionally
    scaled.lumensPerLamp = truncateToThreeDecimals(data.lumensPerLamp * wattageRatio);
    scaled.totalLumens = truncateToThreeDecimals(scaled.lumensPerLamp * scaled.numberOfLamps);
    
    // Scale candela values proportionally
    scaled.candelaValues = data.candelaValues.map(
      horizontalSlice => horizontalSlice.map(value => truncateToThreeDecimals(value * wattageRatio))
    );
    
    // Update wattage
    scaled.inputWatts = truncateToThreeDecimals(newWattage);
    
    return {
      scaledPhotometricData: scaled,
      scalingFactor: wattageRatio
    };
  }

  /**
   * Scale photometric data by lumens change
   * Scales candela values proportionally to maintain consistency
   */
  scaleByLumens(data: PhotometricData, newTotalLumens: number, adjustWattage: boolean = false): ScalingResult {
    const lumensRatio = truncateToThreeDecimals(newTotalLumens / data.totalLumens);
    const scaled = { ...data };
    
    // Scale lumens
    scaled.totalLumens = truncateToThreeDecimals(newTotalLumens);
    scaled.lumensPerLamp = truncateToThreeDecimals(newTotalLumens / data.numberOfLamps);
    
    // Scale candela values proportionally
    scaled.candelaValues = data.candelaValues.map(
      horizontalSlice => horizontalSlice.map(value => truncateToThreeDecimals(value * lumensRatio))
    );
    
    // Optionally adjust wattage to maintain efficacy
    if (adjustWattage) {
      scaled.inputWatts = truncateToThreeDecimals(data.inputWatts * lumensRatio);
    }
    
    return {
      scaledPhotometricData: scaled,
      scalingFactor: lumensRatio
    };
  }

  /**
   * Scale photometric data by length change (Type 4)
   * For linear fixtures only
   */
  scaleByLength(data: PhotometricData, newLengthMm: number, unitsType: number = 2): ScalingResult {
    // Convert mm to file units (meters or feet)
    const newLength = truncateToThreeDecimals(unitsType === 2 ? newLengthMm / 1000.0 : newLengthMm / 304.8);
    const lengthRatio = truncateToThreeDecimals(newLength / data.length);
    
    const scaled = { ...data };
    
    // Scale all photometric values
    scaled.inputWatts = truncateToThreeDecimals(data.inputWatts * lengthRatio);
    scaled.lumensPerLamp = truncateToThreeDecimals(data.lumensPerLamp * lengthRatio);
    scaled.totalLumens = truncateToThreeDecimals(scaled.lumensPerLamp * scaled.numberOfLamps);
    
    // Scale candela values
    scaled.candelaValues = data.candelaValues.map(
      horizontalSlice => horizontalSlice.map(value => truncateToThreeDecimals(value * lengthRatio))
    );
    
    // Update length dimension
    scaled.length = newLength;
    
    return {
      scaledPhotometricData: scaled,
      scalingFactor: lengthRatio
    };
  }

  /**
   * Scale photometric data by any dimension (length, width, or height)
   * For linear fixtures - scales linearly
   */
  scaleByDimension(
    data: PhotometricData,
    newValue: number,  // in meters
    dimension: 'length' | 'width' | 'height'
  ): ScalingResult {
    // Get original value of the scaling dimension
    const originalValue = dimension === 'length' ? data.length :
                         dimension === 'width' ? data.width :
                         data.height;
    
    const ratio = truncateToThreeDecimals(newValue / originalValue);
    
    const scaled = { ...data };
    
    // Scale all photometric values linearly
    scaled.inputWatts = truncateToThreeDecimals(data.inputWatts * ratio);
    scaled.lumensPerLamp = truncateToThreeDecimals(data.lumensPerLamp * ratio);
    scaled.totalLumens = truncateToThreeDecimals(scaled.lumensPerLamp * scaled.numberOfLamps);
    
    // Scale candela values linearly
    scaled.candelaValues = data.candelaValues.map(
      horizontalSlice => horizontalSlice.map(value => truncateToThreeDecimals(value * ratio))
    );
    
    // Update only the scaled dimension, others stay the same
    if (dimension === 'length') {
      scaled.length = truncateToThreeDecimals(newValue);
    } else if (dimension === 'width') {
      scaled.width = truncateToThreeDecimals(newValue);
    } else {
      scaled.height = truncateToThreeDecimals(newValue);
    }
    
    return {
      scaledPhotometricData: scaled,
      scalingFactor: ratio
    };
  }

  /**
   * Check if fixture is linear (length >> width and height)
   */
  isLinearFixture(data: PhotometricData): boolean {
    return (data.length / data.width > 5) && (data.length / data.height > 5);
  }

  /**
   * Swap width and length dimensions
   */
  swapDimensions(data: PhotometricData): PhotometricData {
    return {
      ...data,
      width: data.length,
      length: data.width
    };
  }

  calculateProperties(data: PhotometricData): CalculatedProperties {
    return {
      peakIntensity: this.calculatePeakIntensity(data.candelaValues),
      efficacy: this.calculateEfficacy(data.totalLumens, data.inputWatts),
      beamAngle: this.calculateBeamAngle(data.candelaValues, data.verticalAngles),
      fieldAngle: this.calculateFieldAngle(data.candelaValues, data.verticalAngles),
      lor: this.calculateLOR(data.totalLumens, data.lumensPerLamp, data.numberOfLamps),
      symmetry: this.determineSymmetry(data.candelaValues, data.horizontalAngles),
      centerBeamIntensity: this.getCenterBeamIntensity(data.candelaValues),
    };
  }

  calculateEfficacy(lumens: number, watts: number): number {
    return watts > 0 ? Math.round((lumens / watts) * 100) / 100 : 0;
  }

  calculatePeakIntensity(candelaValues: number[][]): number {
    let max = 0;
    for (const row of candelaValues) {
      for (const value of row) {
        max = Math.max(max, value);
      }
    }
    return Math.round(max * 100) / 100;
  }

  calculateBeamAngle(candelaValues: number[][], verticalAngles: number[]): number {
    const peak = this.calculatePeakIntensity(candelaValues);
    const halfPeak = peak * 0.5;
    
    // Find the angle where intensity drops to 50% of peak
    for (let i = 0; i < candelaValues[0]?.length; i++) {
      if (candelaValues[0][i] <= halfPeak) {
        return verticalAngles[i] * 2; // Double for full beam angle
      }
    }
    
    return 180; // Full sphere if not found
  }

  calculateFieldAngle(candelaValues: number[][], verticalAngles: number[]): number {
    const peak = this.calculatePeakIntensity(candelaValues);
    const tenPercent = peak * 0.1;
    
    // Find the angle where intensity drops to 10% of peak
    for (let i = 0; i < candelaValues[0]?.length; i++) {
      if (candelaValues[0][i] <= tenPercent) {
        return verticalAngles[i] * 2; // Double for full field angle
      }
    }
    
    return 180;
  }

  calculateLOR(totalLumens: number, lumensPerLamp: number, numberOfLamps: number): number {
    const inputLumens = lumensPerLamp * numberOfLamps;
    return inputLumens > 0 ? Math.round((totalLumens / inputLumens) * 100) : 100;
  }

  determineSymmetry(
    candelaValues: number[][],
    horizontalAngles: number[]
  ): 'rotational' | 'symmetric' | 'asymmetric' {
    if (horizontalAngles.length === 1) {
      return 'rotational';
    }
    
    // Check if values are similar across horizontal planes
    const tolerance = 0.1; // 10% tolerance
    let isSymmetric = true;
    
    for (let v = 0; v < candelaValues[0]?.length; v++) {
      const firstValue = candelaValues[0][v];
      for (let h = 1; h < candelaValues.length; h++) {
        const diff = Math.abs(candelaValues[h][v] - firstValue) / firstValue;
        if (diff > tolerance) {
          isSymmetric = false;
          break;
        }
      }
      if (!isSymmetric) break;
    }
    
    return isSymmetric ? 'symmetric' : 'asymmetric';
  }

  getCenterBeamIntensity(candelaValues: number[][]): number {
    // Get the value at 0 degrees (nadir)
    return candelaValues[0]?.[0] || 0;
  }
}

export const photometricCalculator = new PhotometricCalculator();