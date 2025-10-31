import type { IESFile, CalculatedProperties } from '../../types/ies.types';

interface OverviewTabProps {
  currentFile: IESFile;
  calculatedProperties: CalculatedProperties | null;
}

export function OverviewTab({ currentFile, calculatedProperties }: OverviewTabProps) {
  return (
    <>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">File Name</h3>
          <p className="text-2xl font-bold text-gray-900">{currentFile.fileName}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Output</h3>
          <p className="text-2xl font-bold text-gray-900">
            {currentFile.photometricData.totalLumens.toFixed(1)} lm
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Peak Intensity</h3>
          <p className="text-2xl font-bold text-gray-900">
            {calculatedProperties?.peakIntensity.toFixed(2)} cd
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Power</h3>
          <p className="text-2xl font-bold text-gray-900">
            {currentFile.photometricData.inputWatts.toFixed(1)} W
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Efficacy</h3>
          <p className="text-2xl font-bold text-gray-900">
            {calculatedProperties?.efficacy.toFixed(1)} lm/W
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Symmetry</h3>
          <p className="text-2xl font-bold text-gray-900 capitalize">
            {calculatedProperties?.symmetry}
          </p>
        </div>
      </div>

      {/* Test Information */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Test</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.test || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Test Lab</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.testLab || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Test Date</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.testDate || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Issue Date</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.issueDate || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Lamp Position</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.lampPosition || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Other</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.other || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Luminaire Information */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Luminaire Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Manufacturer</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.manufacturer || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Luminaire Description</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.luminaireDescription || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Lamp Catalog #</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.lampCatalogNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Luminaire Catalog #</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.luminaireCatalogNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ballast Description</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.ballastDescription || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ballast Catalog #</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.ballastCatalogNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">CCT</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.colorTemperature ? `${currentFile.metadata.colorTemperature}K` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">CRI</p>
            <p className="font-medium text-gray-900">{currentFile.metadata.colorRenderingIndex || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Photometric Data */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Photometric Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Number of Lamps</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.numberOfLamps}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Lumens Per Lamp</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.lumensPerLamp.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Multiplier</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.multiplier}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tilt</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.tiltOfLuminaire}°</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Photometric Type</p>
            <p className="font-medium text-gray-900">
              {currentFile.photometricData.photometricType === 1 ? 'Type C' : 
               currentFile.photometricData.photometricType === 2 ? 'Type B' : 'Type A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Units</p>
            <p className="font-medium text-gray-900">
              {currentFile.photometricData.unitsType === 1 ? 'Feet' : 'Meters'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Vertical Angles</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.numberOfVerticalAngles}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Horizontal Angles</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.numberOfHorizontalAngles}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ballast Factor</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.ballastFactor}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ballast-Lamp Factor</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.ballastLampPhotometricFactor}</p>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Luminous Dimensions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Width</p>
            <p className="font-medium text-gray-900">
              {currentFile.photometricData.width.toFixed(3)} {currentFile.photometricData.unitsType === 1 ? 'ft' : 'm'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Length</p>
            <p className="font-medium text-gray-900">
              {currentFile.photometricData.length.toFixed(3)} {currentFile.photometricData.unitsType === 1 ? 'ft' : 'm'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Height</p>
            <p className="font-medium text-gray-900">
              {currentFile.photometricData.height.toFixed(3)} {currentFile.photometricData.unitsType === 1 ? 'ft' : 'm'}
            </p>
          </div>
        </div>
      </div>

      {/* Calculated Properties */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Calculated Properties</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Beam Angle</p>
            <p className="font-medium text-gray-900">{calculatedProperties?.beamAngle.toFixed(1)}°</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Field Angle</p>
            <p className="font-medium text-gray-900">{calculatedProperties?.fieldAngle.toFixed(1)}°</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">LOR</p>
            <p className="font-medium text-gray-900">{calculatedProperties?.lor}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Center Beam Intensity</p>
            <p className="font-medium text-gray-900">{calculatedProperties?.centerBeamIntensity.toFixed(2)} cd</p>
          </div>
        </div>
      </div>
    </>
  );
}