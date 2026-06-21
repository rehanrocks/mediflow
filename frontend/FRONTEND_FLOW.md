# MediFlow AI Frontend Flow

Feature: `appointment-frontend`

This document explains how the frontend works, how users move through it, and how it connects to the Django backend.

## What This Frontend Does

The frontend is the clinic portal for MediFlow AI. It lets a clinic user:

- Log in.
- See only the features enabled for their organization.
- View dashboard stats.
- Manage appointments, if the `appointments` feature is enabled.
- Manage patients, if the `patients` feature is enabled.

The frontend does not decide what a clinic is allowed to use by itself. It reads the allowed features from the backend login response.

## Main App Flow

1. A user opens the app.
2. If they are not logged in, they are sent to `/login`.
3. The user enters username and password.
4. The frontend sends the login request to the backend.
5. If login succeeds, the backend returns tokens, role, organization details, and enabled features.
6. The frontend saves that information in `localStorage`.
7. The user is sent to `/dashboard`.
8. During testing, the main frontend routes are public.
9. Each page calls the backend APIs it needs.

## Routes

| Route | Access | What It Shows |
|---|---|---|
| `/login` | Public | Login screen |
| `/dashboard` | Public during testing | Dashboard |
| `/appointments` | Public during testing | Appointments page |
| `/patients` | Public during testing | Patients page |
| `/not-available` | Public during testing | Friendly page when a feature is not enabled |

`/` is reserved for the future home page and does not render the dashboard.

## Login And Stored Data

Login uses:

`POST http://localhost:8000/api/auth/login/`

The frontend sends:

```json
{
  "username": "user",
  "password": "password"
}
```

The backend returns:

```json
{
  "access": "jwt-access-token",
  "refresh": "jwt-refresh-token",
  "role": "receptionist",
  "first_name": "Dana",
  "last_name": "Teller",
  "organization_id": 1,
  "organization_name": "Downtown Clinic",
  "enabled_features": ["appointments", "patients"]
}
```

The frontend stores:

| localStorage key | Value |
|---|---|
| `access` | JWT access token |
| `refresh` | JWT refresh token |
| `user` | Role, name, organization, and enabled features |

The frontend does not hardcode role or features. It uses exactly what the backend returns.

## Authentication

The file `src/context/AuthContext.jsx` manages login state.

It gives the app:

- `user`
- `login(username, password)`
- `logout()`
- `hasFeature(key)`

Example:

```js
hasFeature("appointments")
```

This returns `true` only if the logged-in user's organization has the `appointments` feature.

## Protected Pages

The frontend has two route guards.

### ProtectedRoute

`src/components/ProtectedRoute.jsx`

This checks if a user is logged in.

If there is no user, it redirects to:

`/login`

### FeatureRoute

`src/components/FeatureRoute.jsx`

This checks if an organization has a feature enabled.

Example:

- `/appointments` needs `appointments`.
- `/patients` needs `patients`.

If the feature is missing, the user is sent to:

`/not-available`

This avoids blank pages and gives the user a clear message.

## Backend Connection

All API calls are in:

`src/services/api.js`

The base backend URL is:

```txt
http://localhost:8000/api
```

Every protected API request adds this header automatically:

```txt
Authorization: Bearer <access token>
```

The token comes from:

`localStorage.getItem("access")`

## API Endpoints Used

| Frontend Function | Backend Endpoint | Purpose |
|---|---|---|
| `login()` | `POST /api/auth/login/` | Log in user |
| `refreshToken()` | `POST /api/auth/refresh/` | Refresh access token |
| `getPatients(search)` | `GET /api/patients/?search=` | Get patients |
| `createPatient()` | `POST /api/patients/` | Add patient |
| `getDoctors()` | `GET /api/doctors/` | Get doctors for dropdown |
| `getAppointments()` | `GET /api/appointments/` | Get appointments |
| `bookAppointment()` | `POST /api/appointments/` | Book appointment |
| `updateStatus()` | `PATCH /api/appointments/{id}/update_status/` | Update appointment status |

## Feature-Based Sidebar

The sidebar shows links based on backend-provided features.

Dashboard always shows.

Appointments shows only if:

```js
hasFeature("appointments")
```

Patients shows only if:

```js
hasFeature("patients")
```

This means different clinics can see different modules.

Example:

- Downtown Clinic has `appointments` and `patients`, so it sees both.
- Riverside Medical has only `patients`, so it does not see Appointments.

## Role-Based UI

The backend returns a user role.

The frontend currently uses this role mainly to hide staff-only actions from doctors.

If:

```js
user.role === "doctor"
```

Then:

- The `Book Appointment` button is hidden.
- The appointment status dropdown is hidden.
- The `Add Patient` button is hidden.

Doctors can still view pages they are allowed to access.

## Dashboard Flow

File:

`src/pages/Dashboard.jsx`

The dashboard checks enabled features before fetching data.

If `appointments` is enabled:

- It calls `getAppointments()`.
- It calculates today's appointments.
- It calculates scheduled or in-progress appointments.
- It shows the appointment chart.

If `patients` is enabled:

- It calls `getPatients()`.
- It shows total patients.

If a feature is not enabled, the dashboard does not call that API.

This prevents unnecessary failed requests.

## Appointments Flow

File:

`src/pages/Appointments.jsx`

When the page opens, it fetches:

- Appointments
- Patients
- Doctors

These are used to show the table and fill the booking form dropdowns.

Staff users can:

- Open the booking drawer.
- Select patient.
- Select doctor.
- Pick date and time.
- Add optional reason.
- Submit the appointment.
- Change appointment status.

Doctors can:

- View appointments.
- They cannot book appointments.
- They cannot change status.

Status values are:

- `scheduled`
- `in_progress`
- `completed`
- `cancelled`

Each status has a colored badge.

## Patients Flow

File:

`src/pages/Patients.jsx`

When the page opens, it calls:

`getPatients("")`

The search box is debounced. This means the frontend waits briefly before calling the backend while the user is typing.

Search calls:

```js
getPatients(search)
```

Staff users can add a patient with:

- Full name
- Phone
- Age
- Condition

Doctors cannot add patients.

## Error Handling

The frontend catches backend errors and shows readable messages.

Examples:

- Wrong login details show an inline login error.
- Backend validation errors show inside the form.
- Backend down or request failure shows an error card.
- Feature not enabled redirects to `/not-available`.

For `403` errors, the API service checks the backend message.

If the message means the feature is not enabled, the error gets:

```js
error.featureBlocked = true
```

This helps the UI tell the difference between:

- Not allowed because of role.
- Not available because of plan or feature settings.

## Logout Flow

When the user clicks Sign Out:

1. `access` is removed from localStorage.
2. `refresh` is removed from localStorage.
3. `user` is removed from localStorage.
4. The user is redirected to `/login`.

After logout, protected pages cannot be opened without logging in again.

## Main Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Defines all routes |
| `src/main.jsx` | Starts the React app |
| `src/services/api.js` | Handles backend API calls |
| `src/context/AuthContext.jsx` | Stores auth state and feature helpers |
| `src/components/ProtectedRoute.jsx` | Blocks pages if not logged in |
| `src/components/FeatureRoute.jsx` | Blocks pages if feature is not enabled |
| `src/components/Sidebar.jsx` | Main navigation |
| `src/components/Topbar.jsx` | Page title, search, avatar |
| `src/pages/Login.jsx` | Login page |
| `src/pages/Dashboard.jsx` | Dashboard stats and chart |
| `src/pages/Appointments.jsx` | Appointment list, booking, status update |
| `src/pages/Patients.jsx` | Patient list, search, add patient |
| `src/pages/NotAvailable.jsx` | Feature not enabled page |

## How To Run Frontend

From the `frontend` folder:

```bash
npm install
npm run dev
```

The app runs at:

```txt
http://127.0.0.1:5173/
```

The backend should run at:

```txt
http://localhost:8000/api
```

## Simple Summary

The frontend logs in through the backend, stores the returned user and features, and then shows only the pages that user is allowed to use.

Appointments and patients are connected to backend APIs, but the UI is built so different clinics can have different enabled features.

The backend controls the data and permissions. The frontend displays the correct screens, protects routes, and gives users clear messages when something is not allowed or not enabled.
