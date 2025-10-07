import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { OverviewPage } from './pages/OverviewPage';
import { ChartsPage } from './pages/ChartsPage';
import { EditPage } from './pages/EditPage';
import { View3DPage } from './pages/View3DPage';
import { BatchGeneratorPage } from './pages/BatchGeneratorPage';
import { ExportPage } from './pages/ExportPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="charts" element={<ChartsPage />} />
          <Route path="edit" element={<EditPage />} />
          <Route path="3d" element={<View3DPage />} />
          <Route path="batch" element={<BatchGeneratorPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
