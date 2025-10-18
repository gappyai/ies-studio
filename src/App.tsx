import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { UnifiedPage } from './pages/UnifiedPage';
import { ChartsPage } from './pages/ChartsPage';
import { View3DPage } from './pages/View3DPage';
import { BatchGeneratorPage } from './pages/BatchGeneratorPage';
import { BatchMetadataEditorPage } from './pages/BatchMetadataEditorPage';
import { BatchWattageEditorPage } from './pages/BatchWattageEditorPage';
import { BatchLengthEditorPage } from './pages/BatchLengthEditorPage';

function App() {
  return (
    <BrowserRouter basename="/ies-studio">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<UnifiedPage />} />
          <Route path="file" element={<UnifiedPage />} />
          <Route path="batch-metadata" element={<BatchMetadataEditorPage />} />
          <Route path="batch-wattage" element={<BatchWattageEditorPage />} />
          <Route path="batch-length" element={<BatchLengthEditorPage />} />
          <Route path="batch-cct" element={<BatchGeneratorPage />} />
          <Route path="charts" element={<ChartsPage />} />
          <Route path="3d" element={<View3DPage />} />
          {/* Legacy routes for backward compatibility */}
          <Route path="batch" element={<BatchMetadataEditorPage />} />
          <Route path="batch-generator" element={<BatchGeneratorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
