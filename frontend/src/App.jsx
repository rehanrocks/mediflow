/* src/App.jsx - Defines temporarily public routes for frontend testing. */
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import PortalLayout from './components/PortalLayout.jsx'
import Appointments from './pages/Appointments.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import NotAvailable from './pages/NotAvailable.jsx'
import Patients from './pages/Patients.jsx'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/not-available" element={<NotAvailable />} />

        <Route element={<PortalLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/patients" element={<Patients />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
