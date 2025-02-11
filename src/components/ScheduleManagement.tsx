'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import DataTable from 'react-data-table-component';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import moment from 'moment';
import { db } from '@/utils/firebase';
import {
  collection,
  getDocs,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import { Role, ROLES } from '@/utils/roles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash, faFileExport } from '@fortawesome/free-solid-svg-icons';

// --- Interfaces ---
interface Schedule {
  id?: string;
  subjectId: string;
  teacherId: string;
  room: string;
  days: string[]; // Now an array of days, e.g., ['Monday','Wednesday','Friday']
  startTime: string;
  endTime: string;
  departmentId: string; // Derived from the subject
  createdAt: string;
  approved?: boolean;
}

interface SubjectData {
  id: string;
  subjectCode: string;
  subjectName: string;
  departmentId: string;
}

// New Department interface
interface Department {
  id: string;
  name: string;
  [key: string]: any;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayOptions = daysOfWeek.map(day => ({ value: day, label: day }));

// FullCalendar localizer using moment
const localizer = moment.locale('en');

export default function ScheduleManagement({ role }: { role: Role }) {
  // States for schedules, subjects, teachers, departments, etc.
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state for creating a new schedule (using multi-select for days)
  const [newSchedule, setNewSchedule] = useState({
    subjectId: '',
    teacherId: '',
    room: '',
    days: [] as string[],
    startTime: '',
    endTime: '',
  });
  // State for editing a schedule
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filtering states for DataTable view
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  // For DataTable row selection
  const [selectedRows, setSelectedRows] = useState<Schedule[]>([]);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subjects
        const subjSnapshot = await getDocs(collection(db, 'subjects'));
        setSubjects(
          subjSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as SubjectData))
        );

        // Fetch teachers (filter by role 'teacher')
        const teacherQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teacherSnapshot = await getDocs(teacherQuery);
        setTeachers(
          teacherSnapshot.docs.map(d => ({ ...d.data(), id: d.id }))
        );

        // Fetch departments
        const deptSnapshot = await getDocs(collection(db, 'departments'));
        setDepartments(
          deptSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Department))
        );

        // Fetch schedules
        const scheduleSnapshot = await getDocs(collection(db, 'schedules'));
        setSchedules(
          scheduleSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Schedule))
        );
      } catch (error) {
        Swal.fire('Error', 'Failed to load schedule data', 'error');
      }
      setLoading(false);
    };

    if (ROLES[role]?.canManageSchedule) {
      fetchData();
    }
  }, [role]);

  // Real-time listener for schedules with 500ms delay
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      setTimeout(() => {
        setSchedules(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Schedule)));
      }, 500);
    });
    return () => unsubscribe();
  }, []);

  // --- Helper Functions ---
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Conflict detection now iterates over each selected day
  const hasConflict = (newSch: typeof newSchedule): boolean => {
    const newStart = timeToMinutes(newSch.startTime);
    const newEnd = timeToMinutes(newSch.endTime);
    for (const day of newSch.days) {
      for (const sch of schedules) {
        if (!sch.days.includes(day)) continue;
        if (sch.teacherId === newSch.teacherId) {
          const existingStart = timeToMinutes(sch.startTime);
          const existingEnd = timeToMinutes(sch.endTime);
          if (newStart < existingEnd && newEnd > existingStart) return true;
        }
        if (sch.room === newSch.room) {
          const existingStart = timeToMinutes(sch.startTime);
          const existingEnd = timeToMinutes(sch.endTime);
          if (newStart < existingEnd && newEnd > existingStart) return true;
        }
      }
    }
    return false;
  };

  // Create schedule: derive departmentId from the selected subject
  const handleCreateSchedule = async () => {
    const { subjectId, teacherId, room, days, startTime, endTime } = newSchedule;
    if (!subjectId || !teacherId || !room || days.length === 0 || !startTime || !endTime) {
      Swal.fire('Warning', 'Please fill all required fields', 'warning');
      return;
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      Swal.fire('Warning', 'Start time must be before end time', 'warning');
      return;
    }
    if (hasConflict(newSchedule)) {
      Swal.fire('Warning', 'Schedule conflict detected (teacher or room already booked)', 'warning');
      return;
    }
    // Look up subject to get its departmentId
    const subj = subjects.find(s => s.id === subjectId);
    if (!subj) {
      Swal.fire('Error', 'Selected subject not found', 'error');
      return;
    }
    try {
      const scheduleData: Schedule = {
        ...newSchedule,
        departmentId: subj.departmentId,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'schedules'), scheduleData);
      Swal.fire('Success', 'Schedule added successfully', 'success');
      setNewSchedule({
        subjectId: '',
        teacherId: '',
        room: '',
        days: [],
        startTime: '',
        endTime: '',
      });
    } catch (error: any) {
      Swal.fire('Error', 'Failed to add schedule', 'error');
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async (scheduleId?: string) => {
    if (!scheduleId) return;
    const confirmResult = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete the schedule entry.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
    });
    if (confirmResult.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'schedules', scheduleId));
        Swal.fire('Deleted!', 'Schedule entry deleted.', 'success');
      } catch (error: any) {
        Swal.fire('Error', 'Failed to delete schedule', 'error');
      }
    }
  };

  // Open edit modal
  const openEditModal = (sch: Schedule) => {
    setEditSchedule(sch);
    setIsEditModalOpen(true);
  };

  // Handle changes in edit modal
  const handleEditChange = (field: string, value: string) => {
    if (editSchedule) {
      setEditSchedule({ ...editSchedule, [field]: value });
    }
  };

  // Update schedule entry
  const handleUpdateSchedule = async () => {
    if (!editSchedule || !editSchedule.id) return;
    const { subjectId, teacherId, room, days, startTime, endTime } = editSchedule;
    if (!subjectId || !teacherId || !room || days.length === 0 || !startTime || !endTime) {
      Swal.fire('Warning', 'Please fill all required fields', 'warning');
      return;
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      Swal.fire('Warning', 'Start time must be before end time', 'warning');
      return;
    }
    // Check conflict excluding the edited schedule
    const otherSchedules = schedules.filter(sch => sch.id !== editSchedule.id);
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    for (const day of days) {
      for (const sch of otherSchedules) {
        if (!sch.days.includes(day)) continue;
        if (sch.teacherId === teacherId) {
          const existingStart = timeToMinutes(sch.startTime);
          const existingEnd = timeToMinutes(sch.endTime);
          if (newStart < existingEnd && newEnd > existingStart) {
            Swal.fire('Warning', 'Teacher conflict detected', 'warning');
            return;
          }
        }
        if (sch.room === room) {
          const existingStart = timeToMinutes(sch.startTime);
          const existingEnd = timeToMinutes(sch.endTime);
          if (newStart < existingEnd && newEnd > existingStart) {
            Swal.fire('Warning', 'Room conflict detected', 'warning');
            return;
          }
        }
      }
    }
    try {
      const scheduleRef = doc(db, 'schedules', editSchedule.id);
      await updateDoc(scheduleRef, {
        subjectId,
        teacherId,
        room,
        days,
        startTime,
        endTime,
      });
      Swal.fire('Success', 'Schedule updated successfully', 'success');
      setIsEditModalOpen(false);
      setEditSchedule(null);
    } catch (error: any) {
      Swal.fire('Error', 'Failed to update schedule', 'error');
    }
  };

  // --- FullCalendar Event Helpers ---
  // For each schedule (with multiple days), generate an event for each day.
  const getEventsFromSchedule = (sch: Schedule) => {
    return sch.days.map(day => {
      const now = moment();
      const weekStart = now.clone().startOf('isoWeek'); // Monday
      const dayIndex = daysOfWeek.indexOf(day);
      const eventStart = weekStart.clone().add(dayIndex, 'days').set({
        hour: parseInt(sch.startTime.split(':')[0], 10),
        minute: parseInt(sch.startTime.split(':')[1], 10),
        second: 0,
      });
      const eventEnd = weekStart.clone().add(dayIndex, 'days').set({
        hour: parseInt(sch.endTime.split(':')[0], 10),
        minute: parseInt(sch.endTime.split(':')[1], 10),
        second: 0,
      });
      return {
        id: sch.id, // Note: Multiple events may share the same id; FullCalendar can handle this if needed.
        title: `Sub: ${sch.subjectId} | Room: ${sch.room}`,
        start: eventStart.toDate(),
        end: eventEnd.toDate(),
        extendedProps: { sch },
      };
    });
  };

  const events = schedules.flatMap(getEventsFromSchedule);
  const handleSelectEvent = (info: any) => {
    if (info && info.event.extendedProps.sch) {
      openEditModal(info.event.extendedProps.sch);
    }
  };
  // --- End FullCalendar Helpers ---

  // Filtering for DataTable view
  const filteredSchedules = schedules.filter((sch) => {
    return (
      (!filterDepartment || sch.departmentId === filterDepartment) &&
      (!filterRole || sch.teacherId === filterRole)
    );
  });

  // DataTable columns for schedule view; add a column for "Days"
  const columns = [
    {
      name: 'Subject',
      selector: (row: Schedule) => row.subjectId,
      sortable: true,
    },
    {
      name: 'Teacher',
      selector: (row: Schedule) => row.teacherId,
      sortable: true,
    },
    {
      name: 'Room',
      selector: (row: Schedule) => row.room,
      sortable: true,
    },
    {
      name: 'Days',
      selector: (row: Schedule) => row.days.join(', '),
      sortable: true,
    },
    {
      name: 'Start Time',
      selector: (row: Schedule) => row.startTime,
      sortable: true,
    },
    {
      name: 'End Time',
      selector: (row: Schedule) => row.endTime,
      sortable: true,
    },
  ];

  // Custom subheader toolbar for DataTable
  const SubHeaderComponent = () => {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => {
            if (selectedRows.length !== 1) {
              Swal.fire('Info', 'Please select exactly one schedule to edit', 'info');
            } else {
              openEditModal(selectedRows[0]);
            }
          }}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faEdit} className="mr-2" /> Edit Selected
        </button>
        <button
          onClick={() => {
            if (selectedRows.length === 0) {
              Swal.fire('Info', 'Please select at least one schedule to delete', 'info');
            } else {
              const ids = selectedRows.map((row: Schedule) => row.id) as string[];
              ids.forEach((id) => handleDeleteSchedule(id));
            }
          }}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faTrash} className="mr-2" /> Delete Selected
        </button>
        <button
          onClick={() => {
            if (filteredSchedules.length === 0) {
              Swal.fire('Info', 'No schedules to export', 'info');
              return;
            }
            const grouped = filteredSchedules.reduce((acc: any, sch: Schedule) => {
              const groupKey = `${sch.days} - ${sch.teacherId} - ${sch.room}`;
              if (!acc[groupKey]) acc[groupKey] = [];
              acc[groupKey].push(sch);
              return acc;
            }, {});
            const workbook = XLSX.utils.book_new();
            Object.keys(grouped).forEach((groupKey) => {
              const data = grouped[groupKey].map((sch: Schedule) => ({
                Subject: sch.subjectId,
                Teacher: sch.teacherId,
                Room: sch.room,
                Days: sch.days.join(', '),
                'Start Time': sch.startTime,
                'End Time': sch.endTime,
                'Created At': sch.createdAt,
              }));
              const worksheet = XLSX.utils.json_to_sheet(data);
              XLSX.utils.book_append_sheet(workbook, worksheet, groupKey.substring(0, 31));
            });
            XLSX.writeFile(workbook, 'schedules_export.xlsx');
          }}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faFileExport} className="mr-2" /> Export
        </button>
      </div>
    );
  };

  // Row selection handler for DataTable
  const handleRowSelected = (state: { selectedRows: Schedule[] }) => {
    setSelectedRows(state.selectedRows);
  };

  if (!ROLES[role]?.canManageSchedule) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h3 className="text-red-500">You don't have permission to manage schedules</h3>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Schedule Form */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-primary mb-4">Add Schedule</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={newSchedule.subjectId}
            onChange={(e) => setNewSchedule({ ...newSchedule, subjectId: e.target.value })}
            className="p-3 border rounded-lg"
          >
            <option value="">Select Subject</option>
            {subjects.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.subjectName} ({subj.subjectCode})
              </option>
            ))}
          </select>
          <select
            value={newSchedule.teacherId}
            onChange={(e) => setNewSchedule({ ...newSchedule, teacherId: e.target.value })}
            className="p-3 border rounded-lg"
          >
            <option value="">Select Teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.firstName} {teacher.lastName}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newSchedule.room}
            onChange={(e) => setNewSchedule({ ...newSchedule, room: e.target.value })}
            placeholder="Room"
            className="p-3 border rounded-lg"
          />
          {/* Multi-select for Days using react-select */}
          <Select
            options={dayOptions}
            isMulti
            value={dayOptions.filter(option => newSchedule.days.includes(option.value))}
            onChange={(selectedOptions: any) => {
              const selectedDays = selectedOptions.map((option: { value: string }) => option.value);
              setNewSchedule({ ...newSchedule, days: selectedDays });
            }}
            className="basic-multi-select"
            classNamePrefix="select"
          />
          <input
            type="time"
            value={newSchedule.startTime}
            onChange={(e) => setNewSchedule({ ...newSchedule, startTime: e.target.value })}
            className="p-3 border rounded-lg"
          />
          <input
            type="time"
            value={newSchedule.endTime}
            onChange={(e) => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
            className="p-3 border rounded-lg"
          />
          <button
            onClick={handleCreateSchedule}
            className="col-span-1 md:col-span-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-accent-blue transition-colors"
          >
            Add Schedule
          </button>
        </div>
      </div>

      {/* Calendar View using FullCalendar */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-primary mb-4">Weekly Schedule</h2>
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          events={events}
          eventClick={handleSelectEvent}
          height={500}
        />
      </div>

      {/* Data Table Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <h3 className="text-xl font-semibold text-primary">Filter Schedules:</h3>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">All Departments</option>
            {Array.from(new Set(subjects.map(sub => sub.departmentId))).map((deptId) => {
              const dept = departments.find((d: Department) => d.id === deptId);
              return <option key={deptId} value={deptId}>{dept ? dept.name : 'N/A'}</option>;
            })}
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">All Teachers</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.firstName} {teacher.lastName}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          title="Schedules"
          columns={columns}
          data={filteredSchedules}
          pagination
          responsive
          highlightOnHover
          selectableRows
          onSelectedRowsChange={(state: { selectedRows: Schedule[] }) => setSelectedRows(state.selectedRows)}
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
        />
      </div>

      {/* Edit Schedule Modal */}
      <AnimatePresence>
        {isEditModalOpen && editSchedule && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="bg-white rounded-xl p-6 w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <h3 className="text-2xl font-bold mb-4">Edit Schedule</h3>
              <div className="grid grid-cols-1 gap-4">
                <select
                  value={editSchedule.subjectId}
                  onChange={(e) => handleEditChange('subjectId', e.target.value)}
                  className="p-3 border rounded-lg"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.subjectName} ({subj.subjectCode})
                    </option>
                  ))}
                </select>
                <select
                  value={editSchedule.teacherId}
                  onChange={(e) => handleEditChange('teacherId', e.target.value)}
                  className="p-3 border rounded-lg"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editSchedule.room}
                  onChange={(e) => handleEditChange('room', e.target.value)}
                  placeholder="Room"
                  className="p-3 border rounded-lg"
                />
                {/* Multi-select for days in edit modal */}
                <Select
                  options={dayOptions}
                  isMulti
                  value={dayOptions.filter(option => editSchedule.days.includes(option.value))}
                  onChange={(selectedOptions: any) => {
                    const selectedDays = selectedOptions.map((option: { value: string }) => option.value);
                    handleEditChange('days', selectedDays);
                  }}
                  className="basic-multi-select"
                  classNamePrefix="select"
                />
                <input
                  type="time"
                  value={editSchedule.startTime}
                  onChange={(e) => handleEditChange('startTime', e.target.value)}
                  className="p-3 border rounded-lg"
                />
                <input
                  type="time"
                  value={editSchedule.endTime}
                  onChange={(e) => handleEditChange('endTime', e.target.value)}
                  className="p-3 border rounded-lg"
                />
              </div>
              <div className="flex justify-end mt-6 gap-4">
                <button onClick={() => { setIsEditModalOpen(false); setEditSchedule(null); }} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleUpdateSchedule} className="bg-primary hover:bg-accent-blue text-white px-4 py-2 rounded-lg transition-colors">
                  Save
                </button>
              </div>
              <div className="mt-4">
                <button onClick={() => handleDeleteSchedule(editSchedule.id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors">
                  Delete Schedule
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
