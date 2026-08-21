import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { registerSW, requestNotificationPermission } from './lib/pwa.js'

// Register service worker in all environments (skip in test)
if (import.meta.env.MODE !== 'test') {
  registerSW().then(() => {
    // Request push permission after a short delay (less intrusive)
    setTimeout(() => requestNotificationPermission(), 8000);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
