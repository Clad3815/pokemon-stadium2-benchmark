import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import ModelsAdminPage from './pages/ModelsAdminPage';
import './index.css';
import './styles/fonts.css';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/benchmark" />} />
        <Route path="/benchmark" element={<App page="benchmark" />} />
        <Route path="/statistics" element={<App page="statistics" />} />
        <Route path="/models-admin" element={<ModelsAdminPage mode="list" />} />
        <Route path="/models-admin/new" element={<ModelsAdminPage mode="create" />} />
        <Route path="/models-admin/:modelId/edit" element={<ModelsAdminPage mode="edit" />} />
        {/* Rediriger toutes les autres routes vers benchmark */}
        <Route path="*" element={<Navigate to="/benchmark" />} />
      </Routes>
    </Router>
  </React.StrictMode>
); 
