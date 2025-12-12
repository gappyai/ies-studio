import type { IESFileData, IESMetadata, PhotometricData } from '../types/ies.types';

export class IESParser {
  parse(fileContent: string, fileName: string, fileSize: number): IESFileData {
    try {
      const lines = fileContent.split('\n').map(line => line.trim());
      
      const metadata = this.parseMetadata(lines);
      const photometricData = this.parsePhotometricData(lines);
      
      return {
        metadata,
        photometricData,
        rawContent: fileContent,
        fileName,
        fileSize,
        uploadDate: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to parse IES file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseMetadata(lines: string[]): IESMetadata {
    const metadata: any = {
      format: '',
      manufacturer: '',
      lampCatalogNumber: '',
      luminousOpeningLength: 0,
      luminousOpeningWidth: 0,
      luminousOpeningHeight: 0,
    };

    // Parse header keywords
    for (const line of lines) {
      if (line.startsWith('IESNA') || line.startsWith('IESNA:')) {
        metadata.format = line;
      } else if (line.startsWith('[TEST]')) {
        metadata.test = line.substring(6).trim();
      } else if (line.startsWith('[TESTLAB]')) {
        metadata.testLab = line.substring(9).trim();
      } else if (line.startsWith('[TESTDATE]')) {
        metadata.testDate = line.substring(10).trim();
      } else if (line.startsWith('[ISSUEDATE]')) {
        metadata.issueDate = line.substring(11).trim();
      } else if (line.startsWith('[LAMPPOSITION]')) {
        metadata.lampPosition = line.substring(14).trim();
      } else if (line.startsWith('[OTHER]')) {
        metadata.other = line.substring(7).trim();
      } else if (line.startsWith('[MANUFAC]')) {
        metadata.manufacturer = line.substring(9).trim();
      } else if (line.startsWith('[LUMINAIRE]')) {
        metadata.luminaireDescription = line.substring(11).trim();
      } else if (line.startsWith('[LAMPCAT]')) {
        metadata.lampCatalogNumber = line.substring(9).trim();
      } else if (line.startsWith('[LUMCAT]')) {
        metadata.luminaireCatalogNumber = line.substring(8).trim();
      } else if (line.startsWith('[BALLASTCAT]')) {
        metadata.ballastCatalogNumber = line.substring(12).trim();
      } else if (line.startsWith('[BALLAST]')) {
        metadata.ballastDescription = line.substring(9).trim();
      } else if (line.startsWith('[_COLOR_TEMPERATURE]') || line.startsWith('[COLOR_TEMPERATURE]')) {
        const value = line.substring(line.indexOf(']') + 1).trim().replace('K', '');
        metadata.colorTemperature = parseFloat(value);
      } else if (line.startsWith('[_CRI]') || line.startsWith('[CRI]')) {
        const value = line.substring(line.indexOf(']') + 1).trim();
        metadata.colorRenderingIndex = parseFloat(value);
      } else if (line.startsWith('[NEARFIELD]')) {
        // Extract only the type (first value after [NEARFIELD])
        const parts = line.substring(11).trim().split(/\s+/);
        metadata.nearField = parts[0] || '';
      } else if (line.startsWith('TILT')) {
        // End of keywords section
        break;
      }
    }

    return metadata as IESMetadata;
  }

  private parsePhotometricData(lines: string[]): PhotometricData {
    // Find the start of photometric data (after TILT section)
    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('TILT')) {
        // Skip TILT section
        if (lines[i].includes('NONE')) {
          dataStartIndex = i + 1;
        } else {
          // Skip TILT data if present
          dataStartIndex = i + 2; // Simplified, may need more logic
        }
        break;
      }
    }

    // Parse the main photometric data line
    const dataLine = lines[dataStartIndex].split(/\s+/).filter(s => s.length > 0).map(Number);
    
    const [
      numberOfLamps,
      lumensPerLamp,
      multiplier,
      numberOfVerticalAngles,
      numberOfHorizontalAngles,
      photometricType,
      unitsType,
      width,
      length,
      height,
    ] = dataLine;

    // Parse next line for ballast info and input watts
    const ballastLine = lines[dataStartIndex + 1].split(/\s+/).filter(s => s.length > 0).map(Number);
    const [ballastFactor, ballastLampPhotometricFactor, inputWatts] = ballastLine;

    // Parse vertical angles
    const verticalAnglesStart = dataStartIndex + 2;
    const verticalAngles: number[] = [];
    let currentIndex = verticalAnglesStart;
    
    while (verticalAngles.length < numberOfVerticalAngles && currentIndex < lines.length) {
      const angles = lines[currentIndex].split(/\s+/).filter(s => s.length > 0).map(Number);
      verticalAngles.push(...angles);
      currentIndex++;
    }

    // Parse horizontal angles
    const horizontalAngles: number[] = [];
    while (horizontalAngles.length < numberOfHorizontalAngles && currentIndex < lines.length) {
      const angles = lines[currentIndex].split(/\s+/).filter(s => s.length > 0).map(Number);
      horizontalAngles.push(...angles);
      currentIndex++;
    }

    // Parse candela values
    const candelaValues: number[][] = [];
    for (let h = 0; h < numberOfHorizontalAngles; h++) {
      const verticalData: number[] = [];
      while (verticalData.length < numberOfVerticalAngles && currentIndex < lines.length) {
        const values = lines[currentIndex].split(/\s+/).filter(s => s.length > 0).map(Number);
        verticalData.push(...values);
        currentIndex++;
      }
      candelaValues.push(verticalData);
    }

    return {
      numberOfLamps,
      lumensPerLamp,
      totalLumens: lumensPerLamp * numberOfLamps,
      multiplier,
      tiltOfLuminaire: 0,
      numberOfVerticalAngles,
      numberOfHorizontalAngles,
      photometricType,
      unitsType,
      width,
      length,
      height,
      ballastFactor,
      ballastLampPhotometricFactor,
      inputWatts,
      verticalAngles: verticalAngles.slice(0, numberOfVerticalAngles),
      horizontalAngles: horizontalAngles.slice(0, numberOfHorizontalAngles),
      candelaValues,
    };
  }
}

export const iesParser = new IESParser();