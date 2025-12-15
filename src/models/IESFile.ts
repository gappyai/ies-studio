import type { IESFileData, IESMetadata, PhotometricData } from '../types/ies.types';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { photometricCalculator } from '../services/calculator';

export class IESFile {
  private _data: IESFileData;

  constructor(data: IESFileData) {
    this._data = data;
  }

  static parse(content: string, fileName: string): IESFile {
    const parsed = iesParser.parse(content, fileName, content.length);
    return new IESFile(parsed);
  }

  get data(): IESFileData {
    return this._data;
  }

  get metadata(): IESMetadata {
    return this._data.metadata;
  }

  get photometricData(): PhotometricData {
    return this._data.photometricData;
  }

  get fileName(): string {
    return this._data.fileName;
  }

  set fileName(name: string) {
    this._data.fileName = name;
  }

  updateMetadata(updates: Partial<IESMetadata>): void {
    // Only update fields that have non-empty values, similar to previous util logic
    // or just direct update? 
    // The user requirement says "methods to update metadata".
    // I'll do a direct merge here. Logic for "filtering empty strings" should probably be in the calling layer or specific method if needed.
    // However, keeping the existing behavior of "mergeMetadata" utility which filters empty values might be safer for batch operations.
    // Let's implement a smart merge.
    
    const merged = { ...this._data.metadata };
    
    (Object.keys(updates) as Array<keyof IESMetadata>).forEach((key) => {
      const value = updates[key];
      
      // For string fields, only update if value is non-empty (if that's the desired behavior)
      // Actually, if I want to clear a field, I might pass empty string.
      // The previous logic in UnifiedPage was:
      // "Only update fields that have non-empty values"
      // But for Batch editing, sometimes we want to clear fields?
      // The BatchMetadataEditorPage used `mergeMetadata` which did:
      // if (value.trim() !== '') ...
      
      // I will trust the caller to pass what they want to set. 
      // If the caller wants to clear, they might need to pass empty string.
      // But if the caller passes `undefined`, it is ignored.
      
      if (value !== undefined) {
          (merged as any)[key] = value;
      }
    });
    
    this._data.metadata = merged;
  }

  updateWattage(newWattage: number, updateLumens: boolean = true): void {
    if (updateLumens) {
      const result = photometricCalculator.scaleByWattage(this._data.photometricData, newWattage);
      this._data.photometricData = result.scaledPhotometricData;
    } else {
      this._data.photometricData = {
        ...this._data.photometricData,
        inputWatts: newWattage
      };
    }
  }

  updateLumens(newLumens: number, updateWattage: boolean = true): void {
    const result = photometricCalculator.scaleByLumens(this._data.photometricData, newLumens, updateWattage);
    this._data.photometricData = result.scaledPhotometricData;
  }

  updateDimensions(length?: number, width?: number, height?: number): void {
    let currentData = this._data.photometricData;
    
    // Helper to check if value changed significantly
    const hasChanged = (oldVal: number, newVal?: number) => 
        newVal !== undefined && Math.abs(oldVal - newVal) > 0.001;

    // Prioritize Length > Width > Height for scaling
    if (hasChanged(currentData.length, length)) {
        const result = photometricCalculator.scaleByDimension(currentData, length!, 'length');
        currentData = result.scaledPhotometricData;
    } 
    if (hasChanged(currentData.width, width)) {
        const result = photometricCalculator.scaleByDimension(currentData, width!, 'width');
        currentData = result.scaledPhotometricData;
    } 
    if (hasChanged(currentData.height, height)) {
        const result = photometricCalculator.scaleByDimension(currentData, height!, 'height');
        currentData = result.scaledPhotometricData;
    }

    // Ensure all dimensions are set to new values (in case they were provided but didn't trigger scaling)
    if (length !== undefined) currentData.length = length;
    if (width !== undefined) currentData.width = width;
    if (height !== undefined) currentData.height = height;
    
    // Also update metadata dimensions
    if (length !== undefined) this._data.metadata.luminousOpeningLength = length;
    if (width !== undefined) this._data.metadata.luminousOpeningWidth = width;
    if (height !== undefined) this._data.metadata.luminousOpeningHeight = height;

    this._data.photometricData = currentData;
  }
  
  // Method to handle unit conversion for all dimensions
  convertUnits(toUnit: 'meters' | 'feet'): void {
    const targetUnitType = toUnit === 'feet' ? 1 : 2;
    if (this._data.photometricData.unitsType === targetUnitType) return;
    
    const metersToFeet = (m: number) => m * 3.28084;
    const feetToMeters = (f: number) => f / 3.28084;
    const convert = toUnit === 'feet' ? metersToFeet : feetToMeters;
    
    const data = this._data.photometricData;
    
    data.unitsType = targetUnitType;
    data.length = convert(data.length);
    data.width = convert(data.width);
    data.height = convert(data.height);
    
    this._data.metadata.luminousOpeningLength = data.length;
    this._data.metadata.luminousOpeningWidth = data.width;
    this._data.metadata.luminousOpeningHeight = data.height;
    
    // Note: This does NOT scale candela/lumens/watts, just converts the dimension numbers.
  }

  scaleByCCT(multiplier: number): void {
    const result = photometricCalculator.scaleByCCT(this._data.photometricData, multiplier);
    this._data.photometricData = result.scaledPhotometricData;
  }

  write(): string {
    // Create a copy of the data to modify metadata without affecting the original
    const dataToWrite = { 
      ...this._data,
      metadata: { ...this._data.metadata }
    };

    // If LUMCAT is present, set LUMINAIRE (luminaireDescription) to match it
    if (dataToWrite.metadata.luminaireCatalogNumber && dataToWrite.metadata.luminaireCatalogNumber.trim() !== '') {
      dataToWrite.metadata.luminaireDescription = dataToWrite.metadata.luminaireCatalogNumber;
    }

    return iesGenerator.generate(dataToWrite);
  }
}
