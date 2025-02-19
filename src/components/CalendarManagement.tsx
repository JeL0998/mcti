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
  date: string;         // e.g., "2023-06-15"
  fullDay: boolean;
  startTime?: string;   // if half-day, e.g., "08:00"
  endTime?: string;     // if half-day, e.g., "12:00"
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

export default function CalendarManagement({ currentUser }: { currentUser: CurrentUser }) {
  // States
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states for adding/editing events (only allowed for admin/registrar/dept_head)
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

  // For the DataTable row selection
  const [selectedRows, setSelectedRows] = useState<CalendarEvent[]>([]);

  // --- 1) Permission Checks ---
  if (!ROLES[currentUser.role]?.canManageCalendar && currentUser.role !== 'teacher') {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h3 className="text-red-500">You don't have permission to manage the calendar</h3>
      </div>
    );
  }

  // --- 2) Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch departments
        const deptSnapshot = await getDocs(collection(db, 'departments'));
        setDepartments(
          deptSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Department[]
        );

        // Fetch calendar events
        const eventSnapshot = await getDocs(collection(db, 'calendar'));
        setEvents(
          eventSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as CalendarEvent[]
        );
      } catch (error) {
        console.error('Error loading calendar data:', error);
        Swal.fire('Error', 'Failed to load calendar data', 'error');
      }
      setLoading(false);
    };

    // Load events for all roles (teachers will only view)
    fetchData();
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

  // --- 3) Filtering logic ---
  const filterEvents = (ev: CalendarEvent) => {
    if (currentUser.role === 'teacher') {
      // Teachers see only global or events in their department
      return ev.departmentId === 'all' || ev.departmentId === currentUser.departmentId;
    }
    if (currentUser.role === 'dept_head') {
      return ev.departmentId === 'all' || ev.departmentId === currentUser.departmentId;
    }
    // Admin/registrar see all
    return true;
  };

  const filteredEvents = events.filter(filterEvents);

  // --- 4) FullCalendar Setup ---
  const getCalendarEvent = (ev: CalendarEvent) => {
    const eventStart = new Date(ev.date + (ev.fullDay ? '' : 'T' + (ev.startTime || '00:00')));
    const eventEnd = ev.fullDay
      ? new Date(ev.date + 'T23:59:59')
      : new Date(ev.date + 'T' + (ev.endTime || '00:00'));
    return {
      id: ev.id,
      title: ev.title,
      start: eventStart,
      end: eventEnd,
      allDay: ev.fullDay,
      extendedProps: { ev },
    };
  };

  const calendarEvents = filteredEvents.map(getCalendarEvent);

  const handleEventClick = (info: any) => {
    // Teachers are only allowed to view; only non-teachers can edit via calendar
    if (currentUser.role === 'teacher') return;
    const ev: CalendarEvent = info.event.extendedProps.ev;
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

  // Click on empty date to add event (only allowed if not teacher)
  const handleDateClick = (arg: { dateStr: string }) => {
    if (currentUser.role === 'teacher') return;
    setEditingEvent(null);
    setEventForm({
      title: '',
      date: arg.dateStr,
      fullDay: true,
      startTime: '',
      endTime: '',
      departmentId:
        currentUser.role === 'dept_head'
          ? currentUser.departmentId || ''
          : 'all',
    });
    setIsModalOpen(true);
  };

  // --- 5) Event Form Logic ---
  const handleFormChange = (field: string, value: any) => {
    setEventForm(prev => ({ ...prev, [field]: value }));
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleSaveEvent = async () => {
    const { title, date, fullDay, startTime, endTime, departmentId } = eventForm;
    if (!title || !date) {
      console.log('Validation error: Title and date are required');
      Swal.fire('Warning', 'Title and date are required', 'warning');
      return;
    }
    if (!fullDay && (!startTime || !endTime)) {
      console.log('Validation error: Half-day events require start and end times');
      Swal.fire('Warning', 'Please fill start and end time for half-day events', 'warning');
      return;
    }
    if (!fullDay && timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      console.log('Validation error: Start time must be before end time');
      Swal.fire('Warning', 'Start time must be before end time', 'warning');
      return;
    }
    // For dept head, force department
    const eventDept =
      currentUser.role === 'dept_head' ? currentUser.departmentId || '' : departmentId;

    const eventData: CalendarEvent = {
      title,
      date,
      fullDay,
      startTime: fullDay ? '08:00' : startTime,
      endTime: fullDay ? '17:00' : endTime,
      departmentId: eventDept,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.role,
    };

    try {
      if (editingEvent && editingEvent.id) {
        await updateDoc(doc(db, 'calendar', editingEvent.id), { ...eventData });
        console.log('Event updated:', eventData);
        Swal.fire('Success', 'Event updated successfully', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'calendar'), eventData);
        console.log('New event created with ID:', docRef.id, eventData);
        Swal.fire('Success', 'Event created successfully', 'success');
      }
      setIsModalOpen(false);
      setEditingEvent(null);
    } catch (error: any) {
      console.error('Error saving event:', error);
      Swal.fire('Error', 'Failed to save event', 'error');
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent?.id) return;
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
        console.log('Event deleted:', editingEvent.id);
        Swal.fire('Deleted!', 'Event deleted.', 'success');
        setIsModalOpen(false);
        setEditingEvent(null);
      } catch (error: any) {
        console.error('Error deleting event:', error);
        Swal.fire('Error', 'Failed to delete event', 'error');
      }
    }
  };

  // --- 6) DataTable for events ---
  // Only non-teachers see the DataTable view.
  const tableColumns = [
    {
      name: 'Subject',
      selector: (row: CalendarEvent) => row.title,
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
    {
      name: 'Department',
      selector: (row: CalendarEvent) => row.departmentId || 'all',
      sortable: true,
    },
  ];

  // Subheader for the DataTable
  const SubHeaderComponent = () => {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => {
            if (selectedRows.length !== 1) {
              Swal.fire('Info', 'Please select exactly one event to edit', 'info');
            } else {
              const ev = selectedRows[0];
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
            }
          }}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faEdit} className="mr-2" /> Edit Selected
        </button>
        <button
          onClick={async () => {
            if (selectedRows.length === 0) {
              Swal.fire('Info', 'Please select at least one event to delete', 'info');
              return;
            }
            const confirmResult = await Swal.fire({
              title: 'Are you sure?',
              text: 'This will delete all selected events.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Yes, delete them!',
            });
            if (confirmResult.isConfirmed) {
              try {
                await Promise.all(
                  selectedRows.map(row =>
                    row.id ? deleteDoc(doc(db, 'calendar', row.id)) : Promise.resolve()
                  )
                );
                console.log('Bulk delete success for events:', selectedRows.map(r => r.id));
                Swal.fire('Deleted!', 'Selected events deleted.', 'success');
              } catch (error) {
                console.error('Error bulk deleting events:', error);
                Swal.fire('Error', 'Failed to delete events', 'error');
              }
            }
          }}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faTrash} className="mr-2" /> Delete Selected
        </button>
        <button
          onClick={() => {
            const dataToExport = filteredEvents;
            if (dataToExport.length === 0) {
              Swal.fire('Info', 'No events to export', 'info');
              return;
            }
            const grouped = dataToExport.reduce((acc: any, ev: CalendarEvent) => {
              if (!acc[ev.date]) acc[ev.date] = [];
              acc[ev.date].push(ev);
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

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h3 className="text-gray-600">Loading calendar data...</h3>
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
          events={calendarEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height={600}
        />
      </div>

      {/* DataTable Section: Only display if currentUser is not a teacher */}
      {currentUser.role !== 'teacher' && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-primary mb-4">All Events</h3>
          <DataTable
            title="Events"
            columns={tableColumns}
            data={filteredEvents}
            pagination
            responsive
            highlightOnHover
            selectableRows
            onSelectedRowsChange={(state) => setSelectedRows(state.selectedRows as CalendarEvent[])}
            subHeader
            subHeaderComponent={<SubHeaderComponent />}
            customStyles={{
              headCells: {
                style: {
                  fontWeight: 'bold',
                  backgroundColor: '#f3f4f6',
                },
              },
            }}
            noDataComponent={
              <div className="p-4 text-gray-500 text-center">
                No events to display.
              </div>
            }
          />
        </div>
      )}

      {/* Modal for Adding/Editing Events */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <h3 className="text-2xl font-bold text-primary mb-4">
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  placeholder="Event Title"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                      className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="time"
                      value={eventForm.endTime}
                      onChange={(e) => handleFormChange('endTime', e.target.value)}
                      className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
                {currentUser.role !== 'dept_head' && currentUser.role !== 'teacher' && (
                  <select
                    value={eventForm.departmentId}
                    onChange={(e) => handleFormChange('departmentId', e.target.value)}
                    className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
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