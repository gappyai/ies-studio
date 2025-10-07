import type { PhotometricData, CalculatedProperties } from '../types/ies.types';

export class PhotometricCalculator {
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