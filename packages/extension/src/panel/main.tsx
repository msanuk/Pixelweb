import React from 'react';
import { createRoot } from 'react-dom/client';
import '@web/theme.css';
import './panel.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
