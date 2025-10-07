import { useIESFileStore } from '../store/iesFileStore';
import { PolarChart } from '../components/charts/PolarChart';
import { LinearChart } from '../components/charts/LinearChart';
import { IsoCandelaChart } from '../components/charts/IsoCandelaChart';
import { IsoIlluminanceChart } from '../components/charts/IsoIlluminanceChart';

export function ChartsPage() {
  const { currentFile } = useIESFileStore();

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No file loaded</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0a0a15] p-6">
      <div className="max-w-[1800px] mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Charts</h1>
        
        {/* Top Row - Polar and Linear */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

        {/* Bottom Row - Iso Plots */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IsoCandelaChart
            data={currentFile.photometricData.candelaValues}
            verticalAngles={currentFile.photometricData.verticalAngles}
            horizontalAngles={currentFile.photometricData.horizontalAngles}
          />
          <IsoIlluminanceChart
            data={currentFile.photometricData.candelaValues}
            verticalAngles={currentFile.photometricData.verticalAngles}
            horizontalAngles={currentFile.photometricData.horizontalAngles}
          />
        </div>
      </div>
    </div>
  );
}