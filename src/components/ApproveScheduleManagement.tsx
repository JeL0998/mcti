'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DataTable from 'react-data-table-component';
import { db } from '@/utils/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import { Role } from '@/utils/roles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from './LoadingSpinner';

interface Schedule {
  id?: string;
  subjectId: string;
  teacherId: string;
  room: string;
  days: string[];
  startTime: string;
  endTime: string;
  departmentId: string;
  createdAt: string;
  approved?: boolean;
}

interface Subject {
  id: string;
  subjectName: string;
}

export default function ApproveScheduleManagement({
  currentUserRole,
  currentUserId,
}: {
  currentUserRole: Role;
  currentUserId: string;
}) {
  // If user is not a teacher, deny access
  if (currentUserRole !== 'teacher') {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h3 className="text-red-500 text-lg font-semibold">
          Access Denied: Only teachers can access this page.
        </h3>
      </div>
    );
  }

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Fetch subjects for subjectName lookup
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'subjects'));
        setSubjects(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Subject[]);
      } catch (error) {
        console.error('Error fetching subjects', error);
      }
    };
    fetchSubjects();
  }, []);

  // Fetch only the schedules assigned to the logged-in teacher
  useEffect(() => {
    const q = query(collection(db, 'schedules'), where('teacherId', '==', currentUserId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTimeout(() => {
        setSchedules(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Schedule)));
        setLoading(false);
      }, 500);
    });
    return () => unsubscribe();
  }, [currentUserId]);

  // Helper function to get subjectName from subjectId
  const getSubjectName = (subjectId: string) => {
    const subj = subjects.find((s) => s.id === subjectId);
    return subj ? subj.subjectName : subjectId;
  };

  // Table columns
  const columns = [
    {
      name: 'Subject',
      selector: (row: Schedule) => getSubjectName(row.subjectId),
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

  // Edit / Update
  const handleEditChange = (field: string, value: string | string[]) => {
    if (editSchedule) {
      setEditSchedule({ ...editSchedule, [field]: value });
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editSchedule || !editSchedule.id) return;
    const { subjectId, room, days, startTime, endTime } = editSchedule;

    if (!subjectId || !room || days.length === 0 || !startTime || !endTime) {
      Swal.fire('Warning', 'Please fill all required fields', 'warning');
      return;
    }

    try {
      const scheduleRef = doc(db, 'schedules', editSchedule.id);
      await updateDoc(scheduleRef, { subjectId, room, days, startTime, endTime });
      Swal.fire('Success', 'Schedule updated successfully', 'success');
      setIsEditModalOpen(false);
      setEditSchedule(null);
    } catch (error) {
      Swal.fire('Error', 'Failed to update schedule', 'error');
    }
  };

  // Open edit modal
  const openEditModal = (sch: Schedule) => {
    setEditSchedule(sch);
    setIsEditModalOpen(true);
  };

  // Delete
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
      } catch (error) {
        Swal.fire('Error', 'Failed to delete schedule', 'error');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) {
      Swal.fire('Info', 'Please select at least one schedule to delete', 'info');
      return;
    }
    const confirmResult = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete all selected schedule entries.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete them!',
    });
    if (confirmResult.isConfirmed) {
      try {
        await Promise.all(
          selectedRows.map((row) =>
            row.id ? deleteDoc(doc(db, 'schedules', row.id)) : Promise.resolve()
          )
        );
        Swal.fire('Deleted!', 'Selected schedule entries deleted.', 'success');
      } catch (error) {
        Swal.fire('Error', 'Failed to delete one or more schedule entries', 'error');
      }
    }
  };

  // DataTable row selection
  const handleRowSelected = (state: { selectedRows: Schedule[] }) => {
    setSelectedRows(state.selectedRows);
  };

  // Custom subheader toolbar
  const SubHeaderComponent = () => {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (selectedRows.length !== 1) {
              Swal.fire('Info', 'Please select exactly one schedule to edit', 'info');
            } else {
              openEditModal(selectedRows[0]);
            }
          }}
          className="bg-yellow-500 text-white px-5 py-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <FontAwesomeIcon icon={faEdit} className="mr-2" /> Edit
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleBulkDelete}
          className="bg-red-500 text-white px-5 py-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <FontAwesomeIcon icon={faTrash} className="mr-2" /> Delete
        </motion.button>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <LoadingSpinner />
      </div>
    );
  }

  // No schedules
  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white rounded-xl shadow-lg">
        <h3 className="text-gray-600 text-xl font-semibold">No Schedules Found</h3>
        <p className="mt-2 text-gray-400 text-sm">
          You have no assigned schedules yet. Please contact your administrator if this is unexpected.
        </p>
      </div>
    );
  }

  // Main content
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-8"
    >
      {/* Table Container */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-primary mb-6">Assigned Schedules</h2>
        <DataTable
          columns={columns}
          data={schedules}
          pagination
          responsive
          highlightOnHover
          selectableRows
          onSelectedRowsChange={handleRowSelected}
          subHeader
          subHeaderComponent={<SubHeaderComponent />}
          customStyles={{
            headCells: {
              style: {
                fontWeight: '700',
                backgroundColor: '#f3f4f6',
                padding: '1rem',
              },
            },
            rows: {
              style: {
                padding: '0.75rem',
                transition: 'background-color 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#f9fafb',
                },
              },
            },
          }}
          noDataComponent={
            <div className="p-4 text-center text-gray-500">
              No schedules to display.
            </div>
          }
        />
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editSchedule && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <h3 className="text-2xl font-bold text-primary mb-6">Edit Schedule</h3>
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  value={editSchedule.subjectId}
                  onChange={(e) => handleEditChange('subjectId', e.target.value)}
                  placeholder="Subject ID"
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  value={editSchedule.room}
                  onChange={(e) => handleEditChange('room', e.target.value)}
                  placeholder="Room"
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  value={editSchedule.days.join(', ')}
                  onChange={(e) =>
                    handleEditChange('days', e.target.value.split(',').map((s) => s.trim()))
                  }
                  placeholder="Days (comma separated)"
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="time"
                  value={editSchedule.startTime}
                  onChange={(e) => handleEditChange('startTime', e.target.value)}
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="time"
                  value={editSchedule.endTime}
                  onChange={(e) => handleEditChange('endTime', e.target.value)}
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end mt-8 gap-4">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditSchedule(null);
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSchedule}
                  className="bg-primary hover:bg-accent-blue text-white px-6 py-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
} 