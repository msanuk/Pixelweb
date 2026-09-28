import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { connect } from './lib/ws';
import { loadInitial, setState } from './lib/store';
import { api, setUnauthorizedHandler } from './lib/api';

setUnauthorizedHandler(() => setState({ needLogin: true }));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Ask the server whether a login is needed before opening the WebSocket or loading data.
void api
  .auth()
  .catch(() => ({ required: false, authenticated: true }))
  .then((auth) => {
    setState({ authRequired: auth.required, needLogin: auth.required && !auth.authenticated });
    if (auth.required && !auth.authenticated) return;
    connect();
    void loadInitial();
  });
