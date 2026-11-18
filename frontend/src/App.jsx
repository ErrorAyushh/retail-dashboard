import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './layouts/AppShell';
import Overview from './pages/Overview';
import Stores from './pages/Stores';
import Geography from './pages/Geography';
import Products from './pages/Products';
import DiscountsMargin from './pages/DiscountsMargin';
import ReturnsExchanges from './pages/ReturnsExchanges';
import Staff from './pages/Staff';
import Customers from './pages/Customers';
import DataHealth from './pages/DataHealth';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <FilterProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/stores" element={<Stores />} />
                <Route path="/geography" element={<Geography />} />
                <Route path="/products" element={<Products />} />
                <Route path="/discounts" element={<DiscountsMargin />} />
                <Route path="/returns" element={<ReturnsExchanges />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/health" element={<DataHealth />} />
                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Route>
            </Routes>
          </FilterProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
