import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted variable fonts (offline-safe for the booth — no Google Fonts link).
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
