import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { UnifiedPage } from './pages/UnifiedPage';
import { ChartsPage } from './pages/ChartsPage';
import { View3DPage } from './pages/View3DPage';
import { BatchGeneratorPage } from './pages/BatchGeneratorPage';
import { BatchMetadataEditorPage } from './pages/BatchMetadataEditorPage';

function App() {
  return (
    <BrowserRouter basename="/ies-studio">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<UnifiedPage />} />
          <Route path="file" element={<UnifiedPage />} />
          <Route path="batch" element={<BatchMetadataEditorPage />} />
          <Route path="charts" element={<ChartsPage />} />
          <Route path="3d" element={<View3DPage />} />
          <Route path="batch-generator" element={<BatchGeneratorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
