/* src/app/App.jsx - Defines MediFlow portal routes. */
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppointmentBooking from '@features/appointments/pages/AppointmentBooking.jsx'
import AppointmentEdit from '@features/appointments/pages/AppointmentEdit.jsx'
import AppointmentView from '@features/appointments/pages/AppointmentView.jsx'
import Appointments from '@features/appointments/pages/Appointments.jsx'
import AdminDashboard from '@features/dashboard/pages/AdminDashboard.jsx'
import DoctorDashboard from '@features/dashboard/pages/DoctorDashboard.jsx'
import AddDoctor from '@features/doctors/pages/AddDoctor.jsx'
import DoctorView from '@features/doctors/pages/DoctorView.jsx'
import DoctorsList from '@features/doctors/pages/DoctorsList.jsx'
import EditDoctor from '@features/doctors/pages/EditDoctor.jsx'
import PatientFormPage from '@features/patients/pages/PatientFormPage.jsx'
import PatientView from '@features/patients/pages/PatientView.jsx'
import Patients from '@features/patients/pages/Patients.jsx'
import AddStaff from '@features/staff/pages/AddStaff.jsx'
import EditStaff from '@features/staff/pages/EditStaff.jsx'
import StaffList from '@features/staff/pages/StaffList.jsx'
import StaffView from '@features/staff/pages/StaffView.jsx'
import AdminDashboardRoute from '@shared/components/AdminDashboardRoute.jsx'
import FeatureRoute from '@shared/components/FeatureRoute.jsx'
import PortalLayout from '@shared/components/PortalLayout.jsx'
import ProtectedRoute from '@shared/components/ProtectedRoute.jsx'
import RootRedirect from '@shared/components/RootRedirect.jsx'
import Login from '../pages/Login.jsx'
import NotAvailable from '../pages/NotAvailable.jsx'
import NotFound from '../pages/NotFound.jsx'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/not-available" element={<NotAvailable />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RootRedirect />} />

          <Route element={<PortalLayout />}>
            <Route
              path="/dashboard/admin"
              element={
                <AdminDashboardRoute>
                  <AdminDashboard />
                </AdminDashboardRoute>
              }
            />
            <Route path="/dashboard/doctor" element={<DoctorDashboard />} />

            <Route
              path="/appointments"
              element={
                <FeatureRoute feature="appointments">
                  <Appointments />
                </FeatureRoute>
              }
            />
            <Route
              path="/appointments/book"
              element={
                <FeatureRoute feature="appointments">
                  <AppointmentBooking />
                </FeatureRoute>
              }
            />
            <Route
              path="/appointments/:id"
              element={
                <FeatureRoute feature="appointments">
                  <AppointmentView />
                </FeatureRoute>
              }
            />
            <Route
              path="/appointments/:id/edit"
              element={
                <FeatureRoute feature="appointments">
                  <AppointmentEdit />
                </FeatureRoute>
              }
            />

            <Route
              path="/patients"
              element={
                <FeatureRoute feature="patients">
                  <Patients />
                </FeatureRoute>
              }
            />
            <Route
              path="/patients/new"
              element={
                <FeatureRoute feature="patients">
                  <PatientFormPage mode="add" />
                </FeatureRoute>
              }
            />
            <Route
              path="/patients/:id"
              element={
                <FeatureRoute feature="patients">
                  <PatientView />
                </FeatureRoute>
              }
            />
            <Route
              path="/patients/:id/edit"
              element={
                <FeatureRoute feature="patients">
                  <PatientFormPage mode="edit" />
                </FeatureRoute>
              }
            />

            <Route
              path="/doctors"
              element={
                <FeatureRoute feature="doctors">
                  <DoctorsList />
                </FeatureRoute>
              }
            />
            <Route
              path="/doctors/new"
              element={
                <FeatureRoute feature="doctors">
                  <AddDoctor />
                </FeatureRoute>
              }
            />
            <Route
              path="/doctors/:id"
              element={
                <FeatureRoute feature="doctors">
                  <DoctorView />
                </FeatureRoute>
              }
            />
            <Route
              path="/doctors/:id/edit"
              element={
                <FeatureRoute feature="doctors">
                  <EditDoctor />
                </FeatureRoute>
              }
            />

            <Route
              path="/staff"
              element={
                <FeatureRoute feature="staff">
                  <StaffList />
                </FeatureRoute>
              }
            />
            <Route
              path="/staff/new"
              element={
                <FeatureRoute feature="staff">
                  <AddStaff />
                </FeatureRoute>
              }
            />
            <Route
              path="/staff/:id"
              element={
                <FeatureRoute feature="staff">
                  <StaffView />
                </FeatureRoute>
              }
            />
            <Route
              path="/staff/:id/edit"
              element={
                <FeatureRoute feature="staff">
                  <EditStaff />
                </FeatureRoute>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
