import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// EMERGENCY FIX: Unregister all service workers to fix blank screen
// PWA temporarily disabled until we can debug the caching issue
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      console.log('Unregistering service worker:', registration);
      registration.unregister();
    });
  });

  // Also clear all caches
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      console.log('Deleting cache:', key);
      caches.delete(key);
    });
  });
}
