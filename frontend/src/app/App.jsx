/* src/app/App.jsx - Defines MediFlow portal routes. */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AppointmentBooking from '@features/appointments/pages/AppointmentBooking.jsx'
import AppointmentEdit from '@features/appointments/pages/AppointmentEdit.jsx'
import AppointmentView from '@features/appointments/pages/AppointmentView.jsx'
import Appointments from '@features/appointments/pages/Appointments.jsx'
import GeneralDashboard from '@features/dashboard/pages/AdminDashboard.jsx'
import DoctorDashboard from '@features/dashboard/pages/DoctorDashboard.jsx'
import AccessControl from '@features/access-control/pages/AccessControl.jsx'
import AddDoctor from '@features/doctors/pages/AddDoctor.jsx'
import DoctorView from '@features/doctors/pages/DoctorView.jsx'
import DoctorsList from '@features/doctors/pages/DoctorsList.jsx'
import EditDoctor from '@features/doctors/pages/EditDoctor.jsx'
import Reports from '@features/reports/pages/Reports.jsx'
import PatientFormPage from '@features/patients/pages/PatientFormPage.jsx'
import PatientView from '@features/patients/pages/PatientView.jsx'
import Patients from '@features/patients/pages/Patients.jsx'
import AddStaff from '@features/staff/pages/AddStaff.jsx'
import EditStaff from '@features/staff/pages/EditStaff.jsx'
import StaffList from '@features/staff/pages/StaffList.jsx'
import StaffView from '@features/staff/pages/StaffView.jsx'
import AdminOnlyRoute from '@shared/components/AdminOnlyRoute.jsx'
import ModuleRoute from '@shared/components/ModuleRoute.jsx'
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
              path="/dashboard/general"
              element={<GeneralDashboard />}
            />
            <Route
              path="/dashboard/admin"
              element={<Navigate replace to="/dashboard/general" />}
            />
            <Route path="/dashboard/doctor" element={<DoctorDashboard />} />

            <Route
              path="/appointments"
              element={
                <ModuleRoute action="read" module="appointments">
                  <Appointments />
                </ModuleRoute>
              }
            />
            <Route
              path="/appointments/book"
              element={
                <ModuleRoute action="write" module="appointments">
                  <AppointmentBooking />
                </ModuleRoute>
              }
            />
            <Route
              path="/appointments/:id"
              element={
                <ModuleRoute action="read" module="appointments">
                  <AppointmentView />
                </ModuleRoute>
              }
            />
            <Route
              path="/appointments/:id/edit"
              element={
                <ModuleRoute action="write" module="appointments">
                  <AppointmentEdit />
                </ModuleRoute>
              }
            />

            <Route
              path="/patients"
              element={
                <ModuleRoute action="read" module="patients">
                  <Patients />
                </ModuleRoute>
              }
            />
            <Route
              path="/patients/new"
              element={
                <ModuleRoute action="write" module="patients">
                  <PatientFormPage mode="add" />
                </ModuleRoute>
              }
            />
            <Route
              path="/patients/:id"
              element={
                <ModuleRoute action="read" module="patients">
                  <PatientView />
                </ModuleRoute>
              }
            />
            <Route
              path="/patients/:id/edit"
              element={
                <ModuleRoute action="write" module="patients">
                  <PatientFormPage mode="edit" />
                </ModuleRoute>
              }
            />

            <Route
              path="/doctors"
              element={
                <ModuleRoute action="read" module="doctors">
                  <DoctorsList />
                </ModuleRoute>
              }
            />
            <Route
              path="/doctors/new"
              element={
                <ModuleRoute action="write" module="doctors">
                  <AddDoctor />
                </ModuleRoute>
              }
            />
            <Route
              path="/doctors/:id"
              element={
                <ModuleRoute action="read" module="doctors">
                  <DoctorView />
                </ModuleRoute>
              }
            />
            <Route
              path="/doctors/:id/edit"
              element={
                <AdminOnlyRoute>
                  <EditDoctor />
                </AdminOnlyRoute>
              }
            />

            <Route
              path="/staff"
              element={
                <ModuleRoute action="read" module="staff">
                  <StaffList />
                </ModuleRoute>
              }
            />
            <Route
              path="/staff/new"
              element={
                <ModuleRoute action="write" module="staff">
                  <AddStaff />
                </ModuleRoute>
              }
            />
            <Route
              path="/staff/:id"
              element={
                <ModuleRoute action="read" module="staff">
                  <StaffView />
                </ModuleRoute>
              }
            />
            <Route
              path="/staff/:id/edit"
              element={
                <ModuleRoute action="write" module="staff">
                  <EditStaff />
                </ModuleRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ModuleRoute action="read" module="reports">
                  <Reports />
                </ModuleRoute>
              }
            />
            <Route
              path="/access-control"
              element={
                <AdminOnlyRoute>
                  <AccessControl />
                </AdminOnlyRoute>
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
