import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  // ✅ Optional global error listener to help debug blank screen issues
  useEffect(() => {
    window.addEventListener('error', (e) => {
      console.error('Global Error:', e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled Promise:', e.reason);
    });
  }, []);

  return (
    <Router>
      <Routes>
        {/* ✅ Public route for sign in / sign up */}
        <Route path="/" element={<AuthPage />} />

        {/* ✅ Protected route for authenticated users */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* ✅ Redirect all unknown paths back to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
