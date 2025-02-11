'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import DataTable from 'react-data-table-component';
import * as XLSX from 'xlsx';
import { db } from '@/utils/firebase';
import {
  collection,
  getDocs,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import { Role, ROLES } from '@/utils/roles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash, faFileExport } from '@fortawesome/free-solid-svg-icons';

interface CalendarEvent {
  id?: string;
  title: string;
  date: string;       // e.g., "2023-06-15"
  fullDay: boolean;
  startTime?: string; // if half-day, e.g., "08:00"
  endTime?: string;   // if half-day, e.g., "12:00"
  departmentId: string; // "all" for global events, or a department id
  createdAt: string;
  createdBy: string;
}

interface CurrentUser {
  role: Role;
  departmentId?: string;
}

export interface Department {
  id: string;
  name: string;
  [key: string]: any;
}

// We'll use FullCalendar's built-in month view ("dayGridMonth")
const calendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: '',
  },
  height: 600,
};

export default function CalendarManagement({ currentUser }: { currentUser: CurrentUser }) {
  // States
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states for adding/editing events
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    fullDay: true,
    startTime: '',
    endTime: '',
    departmentId: currentUser.role === 'dept_head' ? (currentUser.departmentId || '') : 'all',
  });

  // Filter events for teachers: if role is teacher, only show events that are global (departmentId "all" or empty)
  // or events for their own department.
  const filterEvents = (ev: CalendarEvent) => {
    if (currentUser.role === 'teacher') {
      return ev.departmentId === 'all' || ev.departmentId === '' || ev.departmentId === currentUser.departmentId;
    } else if (currentUser.role === 'dept_head') {
      // Dept heads see global events plus events for their department.
      return ev.departmentId === 'all' || ev.departmentId === '' || ev.departmentId === currentUser.departmentId;
    }
    return true;
  };

  // Fetch departments and calendar events on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch departments
        const deptSnapshot = await getDocs(collection(db, 'departments'));
        setDepartments(deptSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Department[]);

        // Fetch calendar events
        const eventSnapshot = await getDocs(collection(db, 'calendar'));
        setEvents(
          eventSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as CalendarEvent[]
        );
      } catch (error) {
        Swal.fire('Error', 'Failed to load calendar data', 'error');
      }
      setLoading(false);
    };

    if (ROLES[currentUser.role]?.canManageCalendar) {
      fetchData();
    } else {
      // For teachers, we still load events for viewing
      fetchData();
    }
  }, [currentUser]);

  // Real-time listener for calendar events with slight delay
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'calendar'), (snapshot) => {
      setTimeout(() => {
        setEvents(snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as CalendarEvent[]);
      }, 500);
    });
    return () => unsubscribe();
  }, []);

  // Helper: Create a FullCalendar event object from a CalendarEvent
  const getCalendarEvent = (ev: CalendarEvent) => {
    const eventStart = new Date(ev.date + (ev.fullDay ? '' : 'T' + (ev.startTime || '00:00') + ':00'));
    const eventEnd = ev.fullDay
      ? new Date(ev.date + 'T23:59:59')
      : new Date(ev.date + 'T' + (ev.endTime || '00:00') + ':00');
    return {
      id: ev.id,
      title: ev.title,
      start: eventStart,
      end: eventEnd,
      allDay: ev.fullDay,
      extendedProps: { ev },
    };
  };

  const calendarEvents = events.filter(filterEvents).map(getCalendarEvent);

  // Open modal for adding a new event (if user has permission)
  const handleDateClick = (arg: { dateStr: string }) => {
    // Only allow add if currentUser is admin, registrar, or dept head
    if (currentUser.role === 'teacher') return;
    setEventForm({
      title: '',
      date: arg.dateStr,
      fullDay: true,
      startTime: '',
      endTime: '',
      departmentId: currentUser.role === 'dept_head' ? (currentUser.departmentId || '') : 'all',
    });
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  // When an event is clicked, open modal for editing (if permitted)
  const handleEventClick = (info: any) => {
    const ev: CalendarEvent = info.event.extendedProps.ev;
    // For teachers, we do not allow editing
    if (currentUser.role === 'teacher') return;
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      date: ev.date,
      fullDay: ev.fullDay,
      startTime: ev.startTime || '',
      endTime: ev.endTime || '',
      departmentId: ev.departmentId,
    });
    setIsModalOpen(true);
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Handle form changes
  const handleFormChange = (field: string, value: any) => {
    setEventForm(prev => ({ ...prev, [field]: value }));
  };

  // Save (create or update) an event
  const handleSaveEvent = async () => {
    const { title, date, fullDay, startTime, endTime, departmentId } = eventForm;
    if (!title || !date) {
      Swal.fire('Warning', 'Title and date are required', 'warning');
      return;
    }
    if (!fullDay && (!startTime || !endTime)) {
      Swal.fire('Warning', 'Please fill start and end time for half-day events', 'warning');
      return;
    }
    // For half-day events, ensure start < end
    if (!fullDay && timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      Swal.fire('Warning', 'Start time must be before end time', 'warning');
      return;
    }
    // For dept head, force department to be their own
    const eventDept = currentUser.role === 'dept_head' ? currentUser.departmentId || '' : departmentId;
    const eventData: CalendarEvent = {
      title,
      date,
      fullDay,
      startTime: fullDay ? undefined : startTime,
      endTime: fullDay ? undefined : endTime,
      departmentId: eventDept,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.role, // You might want to use the actual uid instead
    };
    try {
      if (editingEvent && editingEvent.id) {
        // Update
        await updateDoc(doc(db, 'calendar', editingEvent.id), { ...eventData });
        Swal.fire('Success', 'Event updated successfully', 'success');
      } else {
        // Create new event
        await addDoc(collection(db, 'calendar'), eventData);
        Swal.fire('Success', 'Event created successfully', 'success');
      }
      setIsModalOpen(false);
      setEditingEvent(null);
    } catch (error: any) {
      Swal.fire('Error', 'Failed to save event', 'error');
    }
  };

  // Delete an event (only allowed for admin/registrar/dept head editing their own event)
  const handleDeleteEvent = async () => {
    if (editingEvent && editingEvent.id) {
      const confirmResult = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will delete the event.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
      });
      if (confirmResult.isConfirmed) {
        try {
          await deleteDoc(doc(db, 'calendar', editingEvent.id));
          Swal.fire('Deleted!', 'Event deleted.', 'success');
          setIsModalOpen(false);
          setEditingEvent(null);
        } catch (error: any) {
          Swal.fire('Error', 'Failed to delete event', 'error');
        }
      }
    }
  };

  // Filter events based on currentUser for viewing:
  // - Teachers see only global events or those in their department.
  // - Dept heads see global events plus those for their department.
  // - Admin/Registrar see all.
  const filteredCalendarEvents = events.filter(ev => {
    if (currentUser.role === 'teacher') {
      return ev.departmentId === 'all' || ev.departmentId === '' || ev.departmentId === currentUser.departmentId;
    }
    if (currentUser.role === 'dept_head') {
      return ev.departmentId === 'all' || ev.departmentId === '' || ev.departmentId === currentUser.departmentId;
    }
    return true;
  }).map(getCalendarEvent);

  // DataTable columns (optional view below calendar)
  const columns = [
    {
      name: 'Subject',
      selector: (row: CalendarEvent) => row.title, // Here title holds event title
      sortable: true,
    },
    {
      name: 'Date',
      selector: (row: CalendarEvent) => row.date,
      sortable: true,
    },
    {
      name: 'Type',
      selector: (row: CalendarEvent) => (row.fullDay ? 'Full Day' : 'Half Day'),
      sortable: true,
    },
  ];

  // Custom subheader toolbar for DataTable
  const SubHeaderComponent = () => {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => {
            if (!editingEvent) {
              Swal.fire('Info', 'Please click on an event in the calendar to edit', 'info');
            } else {
              setIsModalOpen(true);
            }
          }}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faEdit} className="mr-2" /> Edit Selected
        </button>
        <button
          onClick={() => {
            Swal.fire('Info', 'To delete, please click on the event in the calendar and choose Delete.', 'info');
          }}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faTrash} className="mr-2" /> Delete Selected
        </button>
        <button
          onClick={() => {
            if (filteredCalendarEvents.length === 0) {
              Swal.fire('Info', 'No events to export', 'info');
              return;
            }
            const grouped = filteredCalendarEvents.reduce((acc: any, ev: any) => {
              const groupKey = `${ev.extendedProps.ev.date}`;
              if (!acc[groupKey]) acc[groupKey] = [];
              acc[groupKey].push(ev.extendedProps.ev);
              return acc;
            }, {});
            const workbook = XLSX.utils.book_new();
            Object.keys(grouped).forEach((groupKey) => {
              const data = grouped[groupKey].map((ev: CalendarEvent) => ({
                Title: ev.title,
                Date: ev.date,
                Type: ev.fullDay ? 'Full Day' : 'Half Day',
                'Start Time': ev.startTime || '',
                'End Time': ev.endTime || '',
                Department: ev.departmentId,
                'Created At': ev.createdAt,
              }));
              const worksheet = XLSX.utils.json_to_sheet(data);
              XLSX.utils.book_append_sheet(workbook, worksheet, groupKey.substring(0, 31));
            });
            XLSX.writeFile(workbook, 'calendar_export.xlsx');
          }}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faFileExport} className="mr-2" /> Export
        </button>
      </div>
    );
  };


  if (!ROLES[currentUser.role]?.canManageCalendar && currentUser.role !== 'teacher') {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h3 className="text-red-500">You don't have permission to manage the calendar</h3>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Calendar Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-primary mb-4">School Calendar</h2>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          events={filteredCalendarEvents}
          dateClick={(arg) => {
            // Only allow adding events if currentUser is not teacher
            if (currentUser.role === 'teacher') return;
            setEventForm({
              title: '',
              date: arg.dateStr,
              fullDay: true,
              startTime: '',
              endTime: '',
              departmentId: currentUser.role === 'dept_head' ? (currentUser.departmentId || '') : 'all',
            });
            setEditingEvent(null);
            setIsModalOpen(true);
          }}
          eventClick={handleEventClick}
          height={600}
        />
      </div>


      {/* Modal for Adding/Editing Events */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="bg-white rounded-xl p-6 w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <h3 className="text-2xl font-bold mb-4">{editingEvent ? 'Edit Event' : 'Add Event'}</h3>
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  placeholder="Event Title"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
                <div className="flex items-center gap-4">
                  <span className="font-medium">Full Day?</span>
                  <button
                    onClick={() => handleFormChange('fullDay', true)}
                    className={`px-4 py-2 rounded ${eventForm.fullDay ? 'bg-primary text-white' : 'bg-gray-200'}`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleFormChange('fullDay', false)}
                    className={`px-4 py-2 rounded ${!eventForm.fullDay ? 'bg-primary text-white' : 'bg-gray-200'}`}
                  >
                    No
                  </button>
                </div>
                {!eventForm.fullDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="time"
                      value={eventForm.startTime}
                      onChange={(e) => handleFormChange('startTime', e.target.value)}
                      className="p-3 border rounded-lg"
                    />
                    <input
                      type="time"
                      value={eventForm.endTime}
                      onChange={(e) => handleFormChange('endTime', e.target.value)}
                      className="p-3 border rounded-lg"
                    />
                  </div>
                )}
                {/* Department selection: for admin/registrar only */}
                {currentUser.role !== 'dept_head' && currentUser.role !== 'teacher' && (
                  <select
                    value={eventForm.departmentId}
                    onChange={(e) => handleFormChange('departmentId', e.target.value)}
                    className="p-3 border rounded-lg"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                )}
                {currentUser.role === 'dept_head' && (
                  <input
                    type="text"
                    value={currentUser.departmentId}
                    disabled
                    className="w-full p-3 border rounded-lg bg-gray-100"
                  />
                )}
              </div>
              <div className="flex justify-end mt-6 gap-4">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEvent(null);
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEvent}
                  className="bg-primary hover:bg-accent-blue text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
              {editingEvent && (
                <div className="mt-4">
                  <button
                    onClick={handleDeleteEvent}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Delete Event
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
