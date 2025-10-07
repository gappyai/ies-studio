import { useIESFileStore } from '../store/iesFileStore';
import { PolarChart } from '../components/charts/PolarChart';
import { LinearChart } from '../components/charts/LinearChart';

export function OverviewPage() {
  const { currentFile, calculatedProperties } = useIESFileStore();

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No file loaded</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Overview</h1>
      
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

      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h3>
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

      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Beam Angle</p>
            <p className="font-medium text-gray-900">{calculatedProperties?.beamAngle.toFixed(1)}°</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">LOR</p>
            <p className="font-medium text-gray-900">{calculatedProperties?.lor}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Luminous Width</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.width} m</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Luminous Length</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.length} m</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Luminous Height</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.height} m</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Input Watts</p>
            <p className="font-medium text-gray-900">{currentFile.photometricData.inputWatts || 'N/A'} W</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PolarChart
          data={currentFile.photometricData.candelaValues}
          verticalAngles={currentFile.photometricData.verticalAngles}
          horizontalAngles={currentFile.photometricData.horizontalAngles}
        />
        <LinearChart
          data={currentFile.photometricData.candelaValues}
          verticalAngles={currentFile.photometricData.verticalAngles}
          horizontalAngles={currentFile.photometricData.horizontalAngles}
        />
      </div>
    </div>
  );
}