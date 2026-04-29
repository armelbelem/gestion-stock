import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Articles from './pages/Articles';
import Mouvements from './pages/Mouvements';
import Clients from './pages/Clients';
import Sales from './pages/Sales';
import NewSale from './pages/NewSale';
import Users from './pages/Users';
import Finances from './pages/Finances';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Suppliers from './pages/Suppliers';
import Exercices from './pages/Exercices';
import Transfers from './pages/Transfers';
import AuditLogs from './pages/AuditLogs';
import Stores from './pages/Stores';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect } from 'react';
import { initializeData } from './store/storage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Chargement...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  
  useEffect(() => {
    initializeData();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={user?.role === 'admin' ? <Dashboard /> : <Navigate to="/sales" replace />} />
        <Route path="categories" element={user?.role === 'admin' || user?.role === 'vendeur' ? <Categories /> : <Navigate to="/sales" replace />} />
        <Route path="articles" element={user?.role === 'admin' ? <Articles /> : <Navigate to="/sales" replace />} />
        <Route path="mouvements" element={user?.role === 'admin' ? <Mouvements /> : <Navigate to="/sales" replace />} />
        <Route path="clients" element={<Clients />} />
        <Route path="sales" element={<Sales />} />
        <Route path="sales/new" element={<NewSale />} />
        <Route path="finances" element={user?.role === 'admin' ? <Finances /> : <Navigate to="/sales" replace />} />
        <Route path="payments" element={user?.role === 'admin' ? <Payments /> : <Navigate to="/sales" replace />} />
        <Route path="reports" element={user?.role === 'admin' ? <Reports /> : <Navigate to="/sales" replace />} />
        <Route path="fournisseurs" element={user?.role === 'admin' ? <Suppliers /> : <Navigate to="/sales" replace />} />
        <Route path="users" element={user?.role === 'admin' ? <Users /> : <Navigate to="/sales" replace />} />
        <Route path="exercices" element={user?.role === 'admin' ? <Exercices /> : <Navigate to="/sales" replace />} />
        <Route path="transfers" element={user?.role === 'admin' || user?.role === 'gestionnaire' ? <Transfers /> : <Navigate to="/sales" replace />} />
        <Route path="audit" element={user?.role === 'admin' ? <AuditLogs /> : <Navigate to="/sales" replace />} />
        <Route path="stores" element={user?.role === 'admin' ? <Stores /> : <Navigate to="/sales" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
