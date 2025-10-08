import type { IESFile } from '../types/ies.types';

export class IESGenerator {
  generate(file: IESFile): string {
    const lines: string[] = [];
    
    // Add format line
    lines.push(file.metadata.format || 'IESNA:LM-63-2002');
    
    // Add metadata keywords in proper LEDFLEX order
    if (file.metadata.test) lines.push(`[TEST] ${file.metadata.test}`);
    if (file.metadata.testLab) lines.push(`[TESTLAB] ${file.metadata.testLab}`);
    if (file.metadata.testDate) lines.push(`[TESTDATE] ${file.metadata.testDate}`);
    if (file.metadata.issueDate) lines.push(`[ISSUEDATE] ${file.metadata.issueDate}`);
    if (file.metadata.lampPosition) lines.push(`[LAMPPOSITION] ${file.metadata.lampPosition}`);
    if (file.metadata.other) lines.push(`[OTHER] ${file.metadata.other}`);
    if (file.metadata.manufacturer) lines.push(`[MANUFAC] ${file.metadata.manufacturer}`);
    if (file.metadata.luminaireDescription) lines.push(`[LUMINAIRE] ${file.metadata.luminaireDescription}`);
    if (file.metadata.lampCatalogNumber) lines.push(`[LAMPCAT] ${file.metadata.lampCatalogNumber}`);
    if (file.metadata.luminaireCatalogNumber) lines.push(`[LUMCAT] ${file.metadata.luminaireCatalogNumber}`);
    if (file.metadata.ballastCatalogNumber) lines.push(`[BALLASTCAT] ${file.metadata.ballastCatalogNumber}`);
    if (file.metadata.ballastDescription) lines.push(`[BALLAST] ${file.metadata.ballastDescription}`);
    
    // Add optional metadata (CCT and CRI)
    if (file.metadata.colorTemperature) lines.push(`[_COLOR_TEMPERATURE] ${file.metadata.colorTemperature}K`);
    if (file.metadata.colorRenderingIndex) lines.push(`[_CRI] ${file.metadata.colorRenderingIndex}`);
    
    // Add TILT line
    lines.push('TILT=NONE');
    
    // Add main photometric data line
    const data = file.photometricData;
    lines.push(
      `${data.numberOfLamps} ${data.lumensPerLamp} ${data.multiplier} ` +
      `${data.numberOfVerticalAngles} ${data.numberOfHorizontalAngles} ` +
      `${data.photometricType} ${data.unitsType} ${data.width} ${data.length} ${data.height}`
    );
    
    // Add ballast and input watts line
    lines.push(`${data.ballastFactor} ${data.ballastLampPhotometricFactor} ${data.inputWatts}`);
    
    // Add vertical angles
    lines.push(data.verticalAngles.join(' '));
    
    // Add horizontal angles
    lines.push(data.horizontalAngles.join(' '));
    
    // Add candela values
    for (const horizontalSlice of data.candelaValues) {
      lines.push(horizontalSlice.join(' '));
    }
    
    return lines.join('\n');
  }
  
  generateVariant(
    baseFile: IESFile,
    targetLumens: number,
    dimensions?: { length?: number; width?: number; height?: number },
    newName?: string,
    colorTemperature?: number
  ): IESFile {
    const variant: IESFile = JSON.parse(JSON.stringify(baseFile));
    
    // Scale lumen values
    const ratio = targetLumens / baseFile.photometricData.totalLumens;
    variant.photometricData.lumensPerLamp = baseFile.photometricData.lumensPerLamp * ratio;
    variant.photometricData.totalLumens = targetLumens;
    
    // Scale candela values
    variant.photometricData.candelaValues = baseFile.photometricData.candelaValues.map(
      horizontalSlice => horizontalSlice.map(value => value * ratio)
    );
    
    // Calculate wattage proportionally based on WIDTH change (width represents LED strip length)
    if (dimensions?.width !== undefined && baseFile.photometricData.width > 0) {
      const widthRatio = dimensions.width / baseFile.photometricData.width;
      variant.photometricData.inputWatts = baseFile.photometricData.inputWatts * widthRatio;
    }
    
    // Update dimensions in BOTH metadata and photometricData
    if (dimensions?.length !== undefined) {
      variant.metadata.luminousOpeningLength = dimensions.length;
      variant.photometricData.length = dimensions.length;
    }
    if (dimensions?.width !== undefined) {
      variant.metadata.luminousOpeningWidth = dimensions.width;
      variant.photometricData.width = dimensions.width;
    }
    if (dimensions?.height !== undefined) {
      variant.metadata.luminousOpeningHeight = dimensions.height;
      variant.photometricData.height = dimensions.height;
    }
    
    // Update color temperature if provided
    if (colorTemperature !== undefined) {
      variant.metadata.colorTemperature = colorTemperature;
    }
    
    // Update filename
    if (newName) {
      variant.fileName = newName;
    }
    
    return variant;
  }
}

export const iesGenerator = new IESGenerator();