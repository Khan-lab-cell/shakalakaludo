// Polyfill Node globals required by simple-peer (readable-stream/buffer/events).
// These imports MUST come first, before anything that pulls in simple-peer.
import { Buffer } from 'buffer';
import process from 'process';
import { EventEmitter } from 'events';

if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  window.process = window.process || process;
  window.EventEmitter = window.EventEmitter || EventEmitter;
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// Apply persisted dark mode on boot
const darkPref = localStorage.getItem('ludo:dark');
if (darkPref === '1') document.documentElement.classList.add('dark');

// Global error trap so blank pages still surface the underlying error to the user
window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && root.childElementCount === 0) {
    root.innerHTML = `<div style="padding:20px;font-family:system-ui;color:#b91c1c;background:#fef2f2;min-height:100vh">
      <h1 style="font-size:18px;margin:0 0 8px">App failed to load</h1>
      <pre style="white-space:pre-wrap;font-size:12px;color:#7f1d1d">${(e.error?.stack || e.message || String(e)).replace(/</g, '&lt;')}</pre>
    </div>`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root');
  if (root && root.childElementCount === 0) {
    root.innerHTML = `<div style="padding:20px;font-family:system-ui;color:#b91c1c;background:#fef2f2;min-height:100vh">
      <h1 style="font-size:18px;margin:0 0 8px">App failed to load</h1>
      <pre style="white-space:pre-wrap;font-size:12px;color:#7f1d1d">${String(e.reason?.stack || e.reason || e).replace(/</g, '&lt;')}</pre>
    </div>`;
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
