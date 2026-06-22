/* src/App.jsx - Defines temporarily public routes for frontend testing. */
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import PortalLayout from './components/PortalLayout.jsx'
import AppointmentBooking from './pages/AppointmentBooking.jsx'
import AppointmentEdit from './pages/AppointmentEdit.jsx'
import AppointmentView from './pages/AppointmentView.jsx'
import Appointments from './pages/Appointments.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import NotAvailable from './pages/NotAvailable.jsx'
import NotFound from './pages/NotFound.jsx'
import PatientFormPage from './pages/PatientFormPage.jsx'
import PatientView from './pages/PatientView.jsx'
import Patients from './pages/Patients.jsx'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/not-available" element={<NotAvailable />} />

        <Route element={<PortalLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/appointments" element={<Appointments />} />
          <Route path="/appointments/book" element={<AppointmentBooking />} />
          <Route path="/appointments/:id" element={<AppointmentView />} />
          <Route path="/appointments/:id/edit" element={<AppointmentEdit />} />

          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/new" element={<PatientFormPage mode="add" />} />
          <Route path="/patients/:id" element={<PatientView />} />
          <Route path="/patients/:id/edit" element={<PatientFormPage mode="edit" />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
