import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { AQIAlertProvider } from './context/AQIAlertContext';
import { Toaster } from 'sonner';
import { useContext } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Locations from './pages/Locations';
import Layout from './components/layout/Layout';

// Protected Route Component
const ProtectedRoute = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

// Check if already logged in
const PublicRoute = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return !user ? <Outlet /> : <Navigate to="/" replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AQIAlertProvider>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/locations" element={<Locations />} />
              </Route>
            </Route>
          </Routes>
          <Toaster position="top-center" />
        </AQIAlertProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
