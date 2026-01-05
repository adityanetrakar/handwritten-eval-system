import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SubmissionPage from './pages/SubmissionPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage'; // Import the real page
import Navbar from './components/Navbar'; // Import the Navbar
import { useAuth } from './context/AuthContext';
import CoursePage from './pages/CoursePage';

// Placeholder for the next step
// const CoursePage = () => <h2>Single Course Details Page</h2>;

// A special component to protect routes
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    // If no user, redirect to the login page
    return <Navigate to="/login" />;
  }
  return children;
};

function App() {
  const { user } = useAuth();

  return (
    <>
      {/* The Navbar will only show if a user is logged in */}
      {user && <Navbar />}
      
      <main style={{ padding: '20px' }}>
        <Routes>
          {/* Login Page */}
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" /> : <LoginPage />} 
          />
          <Route 
            path="/register" 
            element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} 
          />
          {/* Dashboard (Protected) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Single Course Page (Protected) */}
          <Route
            path="/course/:id"
            element={
              <ProtectedRoute>
                <CoursePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/submission/:id"
            element={<ProtectedRoute><SubmissionPage /></ProtectedRoute>}
          />

          {/* Default route */}
          <Route 
            path="*" 
            element={<Navigate to={user ? "/dashboard" : "/login"} />} 
          />
        </Routes>
      </main>
    </>
  );
}

export default App;