import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AwsAccounts from './pages/AwsAccounts';
import Projects from './pages/Projects';

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      path="/"
      element={
        <PrivateRoute>
          <Layout><Dashboard /></Layout>
        </PrivateRoute>
      }
    />
    <Route
      path="/aws-accounts"
      element={
        <PrivateRoute>
          <Layout><AwsAccounts /></Layout>
        </PrivateRoute>
      }
    />
    <Route
      path="/projects"
      element={
        <PrivateRoute>
          <Layout><Projects /></Layout>
        </PrivateRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
