import { BrowserRouter, Route, Routes } from 'react-router-dom'

import FeatureRoute from './components/FeatureRoute.jsx'
import PortalLayout from './components/PortalLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
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

        <Route element={<ProtectedRoute />}>
          <Route element={<PortalLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route
              path="/appointments"
              element={
                <FeatureRoute featureKey="appointments">
                  <Appointments />
                </FeatureRoute>
              }
            />
            <Route
              path="/patients"
              element={
                <FeatureRoute featureKey="patients">
                  <Patients />
                </FeatureRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
