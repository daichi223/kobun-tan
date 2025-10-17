import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import { TestGrading } from './TestGrading.tsx'
import Teacher from './pages/Teacher.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/test-grading" element={<TestGrading />} />
        <Route path="/teacher" element={<Teacher />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)