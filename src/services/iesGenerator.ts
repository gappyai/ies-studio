import type { IESFile } from '../types/ies.types';

/**
 * Helper function to truncate numbers to 3 decimal places
 */
function truncateToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

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
    if (file.metadata.nearField) {
      // Construct full NEARFIELD line using type and photometric dimensions
      const nearFieldLine = `[NEARFIELD] ${file.metadata.nearField} ${truncateToThreeDecimals(file.photometricData.length)} ${truncateToThreeDecimals(file.photometricData.width)} ${truncateToThreeDecimals(file.photometricData.height)}`;
      lines.push(nearFieldLine);
    }
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
      `${data.numberOfLamps} ${truncateToThreeDecimals(data.lumensPerLamp)} ${data.multiplier} ` +
      `${data.numberOfVerticalAngles} ${data.numberOfHorizontalAngles} ` +
      `${data.photometricType} ${data.unitsType} ${truncateToThreeDecimals(data.length)} ${truncateToThreeDecimals(data.width)} ${truncateToThreeDecimals(data.height)}`
    );
    
    // Add ballast and input watts line
    lines.push(`${truncateToThreeDecimals(data.ballastFactor)} ${truncateToThreeDecimals(data.ballastLampPhotometricFactor)} ${truncateToThreeDecimals(data.inputWatts)}`);
    
    // Add vertical angles
    lines.push(data.verticalAngles.map(v => truncateToThreeDecimals(v)).join(' '));
    
    // Add horizontal angles
    lines.push(data.horizontalAngles.map(h => truncateToThreeDecimals(h)).join(' '));
    
    // Add candela values
    for (const horizontalSlice of data.candelaValues) {
      lines.push(horizontalSlice.map(v => truncateToThreeDecimals(v)).join(' '));
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
    const ratio = truncateToThreeDecimals(targetLumens / baseFile.photometricData.totalLumens);
    variant.photometricData.lumensPerLamp = truncateToThreeDecimals(baseFile.photometricData.lumensPerLamp * ratio);
    variant.photometricData.totalLumens = truncateToThreeDecimals(targetLumens);
    
    // Scale candela values
    variant.photometricData.candelaValues = baseFile.photometricData.candelaValues.map(
      horizontalSlice => horizontalSlice.map(value => truncateToThreeDecimals(value * ratio))
    );
    
    // Calculate wattage proportionally based on WIDTH change (width represents LED strip length)
    if (dimensions?.width !== undefined && baseFile.photometricData.width > 0) {
      const widthRatio = truncateToThreeDecimals(dimensions.width / baseFile.photometricData.width);
      variant.photometricData.inputWatts = truncateToThreeDecimals(baseFile.photometricData.inputWatts * widthRatio);
    }
    
    // Update dimensions in BOTH metadata and photometricData
    if (dimensions?.length !== undefined) {
      const truncatedLength = truncateToThreeDecimals(dimensions.length);
      variant.metadata.luminousOpeningLength = truncatedLength;
      variant.photometricData.length = truncatedLength;
    }
    if (dimensions?.width !== undefined) {
      const truncatedWidth = truncateToThreeDecimals(dimensions.width);
      variant.metadata.luminousOpeningWidth = truncatedWidth;
      variant.photometricData.width = truncatedWidth;
    }
    if (dimensions?.height !== undefined) {
      const truncatedHeight = truncateToThreeDecimals(dimensions.height);
      variant.metadata.luminousOpeningHeight = truncatedHeight;
      variant.photometricData.height = truncatedHeight;
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