export interface IESFile {
  metadata: IESMetadata;
  photometricData: PhotometricData;
  rawContent: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
}

export interface IESMetadata {
  format: string; // e.g., "IESNA:LM-63-2002"
  test?: string;
  testLab?: string;
  testDate?: string;
  issueDate?: string;
  lampPosition?: string;
  other?: string;
  nearField?: string;
  manufacturer: string;
  luminaireDescription?: string;
  lampCatalogNumber: string;
  luminaireCatalogNumber?: string;
  luminousOpeningLength: number;
  luminousOpeningWidth: number;
  luminousOpeningHeight: number;
  ballastCatalogNumber?: string;
  ballastDescription?: string;
  colorTemperature?: number;
  colorRenderingIndex?: number;
}

export interface PhotometricData {
  numberOfLamps: number;
  lumensPerLamp: number;
  totalLumens: number;
  multiplier: number;
  tiltOfLuminaire: number;
  numberOfVerticalAngles: number;
  numberOfHorizontalAngles: number;
  photometricType: number; // 1=Type C, 2=Type B, 3=Type A
  unitsType: number; // 1=feet, 2=meters
  width: number;
  length: number;
  height: number;
  ballastFactor: number;
  ballastLampPhotometricFactor: number;
  inputWatts: number;
  verticalAngles: number[];
  horizontalAngles: number[];
  candelaValues: number[][]; // [horizontal][vertical]
}

export interface CalculatedProperties {
  peakIntensity: number;
  efficacy: number; // lumens per watt
  beamAngle: number;
  fieldAngle: number;
  lor: number; // Light Output Ratio
  symmetry: 'rotational' | 'symmetric' | 'asymmetric';
  centerBeamIntensity: number;
}

export interface BatchParameters {
  lumenRange: {
    min: number;
    max: number;
    step: number;
  };
  dimensions?: {
    length?: number[];
    width?: number[];
    height?: number[];
  };
  namingPattern: string; // e.g., "{base}_{lumens}lm_{length}x{width}"
  outputCount: number;
}

export type ViewMode = 'overview' | 'edit' | '3d' | 'batch' | 'export';