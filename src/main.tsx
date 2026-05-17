import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import LenisProvider from './components/LenisProvider.tsx'
import './index.css'
import { initWebVitals } from './utils/webVitals'

// Initialize Web Vitals tracking
initWebVitals()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LenisProvider>
      <BrowserRouter>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </BrowserRouter>
    </LenisProvider>
  </React.StrictMode>,
)
