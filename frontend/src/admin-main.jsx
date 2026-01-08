/**
 * Admin Panel Entry Point
 * This file bootstraps the admin application separately from the main app
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './admin/AdminApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
