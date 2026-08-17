# SPECTROPY Result Analysis Portal — Frontend Developer Guide

This document is a starting point for developers who are new to the SPECTROPY frontend. It explains how the application is organized, how the login and dashboard flow works, and where to look when making a change.

## 1. What this project does

The SPECTROPY Result Analysis Portal is a React web application for managing schools, teachers, students, exams, and exam results. Different users see different portals:

| User role | Main route | Main responsibility |
| --- | --- | --- |
| SPECTROPY admin | `/admin` | Manage schools, classes, teachers, students, exams, and reports |
| School owner | `/school` | View school data, analytics, students, teachers, exams, and certificates |
| Teacher | `/teacher` | View assigned school/class information, rankings, and exam-related data |
| Student | `/student` | View personal exam performance and results |
| Parent | `/parent` | View a student's exam performance and school information |
| Guest | `/guest` | Access the guest area |

The application starts at `/login`. After successful login, the user is redirected to the route belonging to their role.

## 2. Technologies used

- React 18 — builds the user interface with components.
- Vite — runs the development server and creates the production build.
- React Router — handles URLs, navigation, and protected routes.
- `fetch` — sends requests to the backend API.
- Supabase client — configured in `src/supabaseClient.js` for Supabase access.
- Recharts — displays charts and analytics.
- Lucide React — provides interface icons.
- XLSX — reads or creates Excel-related data.
- jsPDF and jsPDF AutoTable — creates PDF reports.
- JSZip and File Saver — packages and downloads files.

## 3. Project structure

```text
.
├── public/                 # Files served directly by the browser
├── src/
│   ├── assets/             # Images, logos, subject icons, and certificate template
│   ├── components/         # Login, dashboards, forms, tables, reports, and views
│   ├── api.js              # Shared backend API helper functions
│   ├── App.jsx             # Application shell, routes, session, and route guards
│   ├── Dashboard.jsx       # SPECTROPY admin dashboard
│   ├── main.jsx            # React entry point
│   ├── styles.css          # Global styles and reusable CSS classes
│   └── supabaseClient.js   # Supabase client configuration
├── index.html              # HTML page containing the React mount element
├── vite.config.js          # Vite server and API proxy configuration
├── package.json            # Scripts and dependencies
└── .env                    # Local environment values; do not commit secrets
```

### Important files

#### `src/main.jsx`

This is the frontend entry point. It renders `<App />`, enables React Strict Mode, wraps the application in `BrowserRouter`, and imports the global stylesheet.

#### `src/App.jsx`

This is the application shell. It contains:

1. The role-to-route map.
2. Session restoration when the page loads.
3. Login and logout handlers.
4. The common header.
5. The React Router routes.
6. The `Protected` component, which prevents users from opening a route for another role.

Do not add another `BrowserRouter` inside `App.jsx`; it is already provided by `main.jsx`.

#### `src/Dashboard.jsx`

This is the admin portal. It coordinates admin navigation and renders admin features such as school management, registrations, exam registration, queries, and reports.

#### `src/components/`

Each file generally represents a screen, dashboard, form, table, or reusable feature. For example:

- `LoginPage.jsx` — role selection and login forms.
- `SchoolOwnerDashboard.jsx` — school owner portal and analytics.
- `TeacherDashboard.jsx` — teacher portal.
- `StudentDashboard.jsx` and `ParentDashboard.jsx` — result views for students and parents.
- `StudentPerformanceView.jsx` — shared performance presentation and chart/report UI.
- `StudentRegistration.jsx` — student upload, listing, and deletion UI.
- `ClassTeacherRegistration.jsx` — class, teacher, and teacher-assignment UI.
- `ExamsRegistration.jsx` — exam setup and registration UI.
- `OMRUploadView.jsx` — OMR result upload UI.
- `ReportButtons.jsx` and `downloadpdf.jsx` — PDF/report download helpers.

## 4. How the application starts

The high-level flow is:

```text
Browser
  ↓
index.html
  ↓
src/main.jsx
  ↓
BrowserRouter + App
  ↓
AppShell restores the session
  ↓
/login or the correct role dashboard
```

The root URL (`/`) redirects to `/login`. Unknown URLs also redirect to `/login`.

## 5. Login, roles, and protected routes

`LoginPage.jsx` calls the backend login endpoints and returns a user object to `App.jsx` through the `onLogin` prop. `App.jsx` stores that object and navigates to the correct role route.

The role values used by the frontend are:

```text
SPECTROPY_ADMIN
SCHOOL_OWNER
TEACHER
STUDENT
PARENT
GUEST
```

`Protected` checks two things:

- If there is no user, redirect to `/login`.
- If the user has the wrong role, redirect to the route for their own role.

When adding a new role, update all of these areas together:

1. `ROLE_ROUTES` in `src/App.jsx`.
2. The route definition in `AppShell`.
3. The login UI and login request in `src/components/LoginPage.jsx`.
4. The dashboard/component for that role.
5. The logout and header behavior if needed.

## 6. Session storage

The current session is stored as JSON under the key `sp_user` in both `localStorage` and `sessionStorage`. School-specific values may also use:

- `sp_school_id`
- `sp_school_name`

On application startup, `App.jsx` reads the stored user and restores the login state. On logout, the stored user and school values are removed and the session storage is cleared.

When reading the current user in a component, follow the existing pattern and handle invalid or missing JSON safely. Never store passwords or secret API keys in browser storage.

## 7. Backend API communication

Shared API functions live in `src/api.js`. They use this base URL:

```js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
```

Examples of shared functions include:

- `getSchools()` and `createSchool()`
- `createClass()` and `createTeacher()`
- `assignTeacherToClass()`
- `uploadStudents()`
- `getStudentsByClassSection()`
- `getFoundations()`, `getPrograms()`, and `getExams()`
- `createExam()`
- delete functions for students, classes, teachers, and assignments

Many larger dashboard components also call `fetch` directly when the request is specific to that screen. For a request used by multiple screens, add a helper to `src/api.js` instead of duplicating the request.

Typical request pattern:

```js
const response = await fetch(`${API_BASE}/api/example`);
if (!response.ok) {
  throw new Error("Request failed");
}
const data = await response.json();
```

`api.js` contains shared error formatting, including a friendly message for duplicate student IDs. Preserve that behavior when adding shared API functions.

### File uploads

For file uploads, use `FormData`. Do not manually set the `Content-Type` header; the browser must add the multipart boundary automatically.

```js
const formData = new FormData();
formData.append("file", file);
formData.append("class_section", classSection);

await uploadStudents(schoolId, formData);
```

## 8. Environment setup

Create or update a local `.env` file with the values required by your local backend and Supabase project:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Vite exposes only variables beginning with `VITE_` to frontend code. Do not put private backend secrets in this file or in any `VITE_` variable. Frontend-exposed values are visible in the browser bundle.

The Vite development server also proxies `/api` requests to `http://localhost:4000`. Make sure the backend is running before testing features that load data.

## 9. Install and run the project

Prerequisites:

- Node.js and npm installed.
- The backend API running on port `4000`, unless `VITE_API_BASE_URL` points somewhere else.
- Valid local environment values.

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/). The root URL redirects to the login page.

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The repository currently has no separate test script. Always run `npm run build` after frontend changes because it catches import, JSX, and bundling errors.

## 10. How to make a frontend change

Use this workflow for a new feature or bug fix:

1. Find the screen responsible for the behavior in `src/components/` or `src/Dashboard.jsx`.
2. Find the state that controls the UI using `useState`.
3. Find data loading and refresh behavior using `useEffect` and the relevant API helper.
4. Update the component state after successful create, update, or delete operations.
5. Add loading, empty, and error states so the user can understand what is happening.
6. Reuse existing CSS classes and design tokens from `src/styles.css` where possible.
7. Run `npm run build` and manually test the affected role route.

For a new API endpoint:

1. Confirm the endpoint, HTTP method, request body, and response shape with the backend.
2. Add a reusable function to `src/api.js` if more than one screen may use it.
3. Check `response.ok` and convert failures into a useful error message.
4. Refresh the relevant data after a successful mutation.

## 11. Styling conventions

Global styles are in `src/styles.css`. The project already has reusable classes such as buttons, cards, tables, forms, alerts, spinners, and responsive layout helpers. Prefer using those classes before adding one-off inline styles.

The application also uses CSS variables such as:

- `--color-bg`
- `--color-text-main`
- `--color-text-muted`
- `--color-border`
- `--primary-600`

If a visual change should apply across the portal, add or update the global style. If it is specific to one component, keep the change local and use a descriptive class name.

## 12. Common troubleshooting

### The page is blank or does not compile

Check the terminal for an import path, JSX, or syntax error. Confirm that the imported filename and its capitalization match the actual file. Run:

```bash
npm run build
```

### API requests fail

Check that the backend is running on port `4000`, the `.env` file has the correct `VITE_API_BASE_URL`, and the browser Network tab shows the expected URL. Restart Vite after changing `.env` values.

### The user is redirected to login

Inspect `localStorage` and `sessionStorage` for `sp_user`. Confirm that the stored object contains a role matching one of the supported role strings exactly.

### Data is stale after saving

After a successful mutation, call the screen's existing fetch/refresh function or update the relevant state. Avoid refreshing before the API request has completed.

### A chart or PDF is incorrect

Check the shape of the API response before changing the rendering code. `StudentPerformanceView.jsx`, `ReportButtons.jsx`, and `downloadpdf.jsx` transform result data for display or export, so a backend field-name change may affect more than one place.

## 13. Developer notes

- Keep role names and route names consistent with `src/App.jsx`.
- Use stable IDs as React `key` values when rendering lists.
- Disable buttons during submissions to prevent duplicate requests.
- Show a clear loading state while fetching data.
- Show a useful empty state when a school, class, or exam has no data.
- Avoid logging personal student information in production code.
- Do not commit `.env`, credentials, or generated build output unless the team specifically requires it.
- Some components are intentionally large legacy screens. Make focused changes and avoid unrelated rewrites.

## 14. Quick orientation for a fresher

Start reading in this order:

1. `src/main.jsx` — see how React starts.
2. `src/App.jsx` — understand routes, session, and roles.
3. `src/components/LoginPage.jsx` — understand login responses.
4. `src/api.js` — learn the shared API request pattern.
5. One dashboard, such as `StudentDashboard.jsx` — follow loading, state, and rendering.
6. `src/styles.css` — learn the existing visual system.

For a small practice change, update a loading or empty state in a dashboard, run the app, and then run `npm run build`. This gives a new developer experience with routing, React state, API data, and styling without changing the database model.
