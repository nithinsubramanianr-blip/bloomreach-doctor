import { Routes, Route } from 'react-router-dom';
import PLPPage from './m5-plp/pages/PLPPage';
import DashboardApp from './m4-dashboard/App';

/**
 * Shared shell for the PPD demo.
 *
 *   /         → M5 PLP (spec 006-react-plp)
 *   /doctor   → M4 dashboard (spec 005)
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PLPPage />} />
      <Route path="/doctor" element={<DashboardApp />} />
      <Route path="*" element={<PLPPage />} />
    </Routes>
  );
}
