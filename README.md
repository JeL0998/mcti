# MCTI Class Scheduling Management System

The **MCTI Class Scheduling Management System** is a web-based platform designed for Marvelous College of Technology Incorporated (MCTI) to manage faculty scheduling, subjects, users, and school calendar events. This system is built using Next.js (with the App Router) for the frontend and uses Firestore as its database. Instead of Firebase Authentication, user credentials and roles are stored in Firestore and persisted on the client via localStorage.

The system is divided into several key management modules:

- **User Management**
- **Subject Management**
- **Schedule Management**
- **Calendar Management**

Each module is built as a separate client component that leverages Tailwind CSS for a responsive, modern UI and Framer Motion for smooth animations and transitions.

---

## Table of Contents

- [User Management](#user-management)
- [Subject Management](#subject-management)
- [Schedule Management](#schedule-management)
- [Calendar Management](#calendar-management)
- [Project Architecture & Setup](#project-architecture--setup)
- [Conclusion](#conclusion)

---

## User Management

**Location:** `src/components/UserManagement.tsx`

**Overview:**  
The User Management module is responsible for managing user accounts for MCTI. It provides a form to create new users and a data table to view, filter, edit, and delete existing users.

**Key Features:**

- **Form for Creating Users:**  
  - **Fields:** Username, Email, First Name, Last Name, Password, and Role.
  - **Role-Based Options:**  
    - **Admin:** Can create all types of users, including Admins and Registrars.
    - **Registrar:** Can manage all users except Admins.
    - **Dept Head:** Can only manage teachers in their own department.
    - **Teacher:** Do not have user management privileges.
  - **Password Security:**  
    Passwords are hashed using bcrypt before being stored in Firestore.
  - **Validation:**  
    The form validates required fields and the proper email format.
  
- **Data Table View:**  
  - Built using **react-data-table-component**.
  - Supports filtering by department and role.
  - Includes a custom toolbar (subheader) with buttons for editing, deleting, and exporting users.
  - Real‑time updates are implemented via Firestore’s onSnapshot with a slight delay for smooth UI transitions.
  
- **Modals for Editing:**  
  - Editing is done via modal dialogs that leverage Framer Motion for smooth transitions.
  - The modal allows updating user details (password remains unchanged during edit).

**Usage:**  
Admins, Registrars, and Dept Heads use this module to add or modify user accounts based on their permissions. Teachers do not have access to this module.

---

## Subject Management

**Location:** `src/components/SubjectManagement.tsx`

**Overview:**  
The Subject Management module lets administrators, registrars, and department heads manage academic subjects. Each subject is associated with a specific department and course.

**Key Features:**

- **Form for Creating Subjects:**  
  - **Fields:** Subject Code (must be unique), Subject Name, Year Level, Units/Credits, and Semester.
  - **Association:** Subjects are linked to a department and a course within that department.
  - **Validation:** Ensures all fields are filled and that the subject code is unique.
  
- **Data Table View:**  
  - A data table displays a list of subjects with filtering options.
  - Users can filter by department.
  - The table supports real-time updates and export functionality (grouped by role/department) using XLSX.
  
- **Modal-Based Editing:**  
  - Editing is done through a modal dialog with Framer Motion animations.
  - Users can update subject details or delete subjects.
  
- **Role-Based Permissions:**  
  - **Admin & Registrar:** Full access to manage all subjects.
  - **Dept Head:** Can only manage subjects in their own department.
  - **Teacher:** Do not have subject management privileges.

**Usage:**  
This module helps maintain the academic curriculum by allowing authorized users to add or modify subjects.

---

## Schedule Management

**Location:** `src/components/ScheduleManagement.tsx`

**Overview:**  
The Schedule Management module manages class schedules for subjects. It allows for the creation of schedules that can recur on multiple days of the week. This module integrates a calendar view and a data table view for detailed schedule management.

**Key Features:**

- **Optimized Schedule Entry:**  
  - Instead of creating a separate schedule entry per subject-day, the form now uses a **multi‑select** (using **react-select**) to choose multiple days (e.g., MWF, TTh, etc.).
  - The schedule form includes fields for Subject, Teacher, Room, Multiple Days, Start Time, and End Time.
  
- **Conflict Detection:**  
  - The system checks for conflicts to ensure that a teacher or room isn’t double-booked during overlapping times.
  
- **Calendar View:**  
  - Integrated with **FullCalendar React** (or an alternative) to display the weekly schedule.
  - The helper function converts schedule entries (which may include multiple days) into individual calendar events.
  
- **Data Table View:**  
  - A data table (via react-data-table-component) displays all schedule entries.
  - Includes filtering by department and teacher.
  - Real‑time updates are implemented with a slight delay.
  
- **Role-Based Permissions:**  
  - **Admin & Registrar:** Full access.
  - **Dept Head:** Can manage schedules only for their department.
  - **Teacher:** Can view and potentially approve schedules but cannot create or edit them.

**Usage:**  
This module allows authorized users to create and manage class schedules efficiently by selecting multiple days at once, with built-in conflict detection and both calendar and tabular views.

---

## Calendar Management

**Location:** `src/components/CalendarManagement.tsx`

**Overview:**  
The Calendar Management module enables the management of school-wide events and holidays. Events are stored in a Firestore collection and are displayed in a monthly calendar view.

**Key Features:**

- **Event Form:**  
  - A modal dialog allows users (Admins, Registrars, and Dept Heads) to add or edit events.
  - **Fields:** Event Title, Date, and whether the event is a Full Day or Half Day event (with time inputs if half-day).
  - **Department Selection:**  
    - Admins/Registrars can choose "All Departments" (global) or a specific department.
    - Dept Heads are limited to events for their own department.
  
- **FullCalendar Integration:**  
  - The component uses **FullCalendar React** in month view (`dayGridMonth`).
  - When a day is clicked (by a user with permissions), the add‑event modal is displayed.
  - When an event is clicked, the modal opens in edit mode.
  
- **Real‑Time Updates:**  
  - Events are updated in real time using Firestore’s onSnapshot with a slight delay.
  
- **Data Table View (Optional):**  
  - A data table view is provided for exporting events. Events can be grouped by date and exported as an Excel file.
  
- **Role-Based Viewing:**  
  - **Admin & Registrar:** Can view, add, and edit all events.
  - **Dept Head:** Can add events only for their own department.
  - **Teacher:** Can view global events and those from their own department, but not events from other departments.

**Usage:**  
This module allows for centralized management of school events. Authorized users can quickly add or modify events via a modal interface, and the monthly calendar provides a clear overview of upcoming events and holidays.

---

## Project Architecture & Setup

### Architecture Overview
- **Frontend:**  
  The project is built with Next.js using the App Router. Each module (User Management, Subject Management, Schedule Management, Calendar Management) is implemented as a separate client component.
- **Backend:**  
  Firestore is used as the database for storing all data (users, subjects, schedules, and calendar events).
- **Authentication & Session Management:**  
  Instead of Firebase Auth, authentication is handled via Firestore and persisted in localStorage. Custom hooks are used to retrieve the current user's role and related data.
- **Styling & Animations:**  
  Tailwind CSS is used for modern, responsive styling, and Framer Motion is used for smooth animations and transitions.
- **Data Table & Calendar Components:**  
  - **react-data-table-component** is used for building responsive data tables with built‑in filtering, pagination, and export features.
  - **FullCalendar React** is used for the calendar views in both schedule and calendar management modules.

### Setup Instructions
1. **Install Dependencies:**  
   Run `npm install` (or `yarn install`) at the project root.
2. **Configure Firebase:**  
   Update `src/utils/firebase.ts` with your Firebase configuration.
3. **Install Additional Packages:**  
   Ensure the following packages are installed:
   - FullCalendar React and its plugins:  
     `npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction`
   - React Select:  
     `npm install react-select`
   - react-data-table-component, framer-motion, sweetalert2, bcryptjs, and XLSX (if not already installed).
4. **Run the Development Server:**  
   Run `npm run dev` (or `yarn dev`) and navigate to the dashboard (e.g., `/dashboard`).

---

## Conclusion

This MCTI Class Scheduling Management System is designed to be a comprehensive solution for managing users, academic subjects, class schedules, and school calendar events. Each module is optimized for real-time data updates, role‑based access, and a modern, responsive user interface using Next.js, Firestore, Tailwind CSS, Framer Motion, and several other libraries. The system provides robust functionality to streamline administrative tasks at MCTI while ensuring that each role sees and manages only the data relevant to them.
