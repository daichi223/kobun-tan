import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AuthGuard from './auth/AuthGuard.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGuard>
      <App />
    </AuthGuard>
  </React.StrictMode>,
)