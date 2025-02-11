'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  query,
  where,
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import { Role, ROLES } from '@/utils/roles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash, faFileExport, faFileImport } from '@fortawesome/free-solid-svg-icons';

interface Subject {
  id?: string;
  subjectCode: string;
  subjectName: string;
  yearLevel: string;
  units: string;
  semester: string;
  departmentId: string;
  courseId: string;
  createdAt: string;
}

export default function SubjectManagement({ role }: { role: Role }) {
  // States for subject management
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  // For the create form: courses for the selected department
  const [courses, setCourses] = useState<any[]>([]);
  // Global courses: all courses from all departments
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [newSubject, setNewSubject] = useState({
    subjectCode: '',
    subjectName: '',
    yearLevel: '',
    units: '',
    semester: '',
    departmentId: '',
    courseId: '',
  });
  const [loading, setLoading] = useState(true);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // States for filtering the data table
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterCourse, setFilterCourse] = useState<string>('');
  // DataTable row selection state
  const [selectedRows, setSelectedRows] = useState<Subject[]>([]);

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const deptSnapshot = await getDocs(collection(db, 'departments'));
        setDepartments(deptSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        Swal.fire('Error', 'Failed to load departments', 'error');
      }
    };
    fetchDepartments();
  }, []);

  // Fetch all courses from all departments once departments are loaded
  useEffect(() => {
    if (departments.length > 0) {
      const fetchAllCourses = async () => {
        let coursesArray: any[] = [];
        for (const dept of departments) {
          try {
            const coursesSnapshot = await getDocs(collection(db, `departments/${dept.id}/courses`));
            const deptCourses = coursesSnapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
              departmentId: dept.id, // include the department id
            }));
            coursesArray = coursesArray.concat(deptCourses);
          } catch (error) {
            console.error('Error fetching courses for department', dept.id, error);
          }
        }
        setAllCourses(coursesArray);
      };
      fetchAllCourses();
    }
  }, [departments]);

  // When new subject's department changes (for the create form), update state and fetch courses for that department
  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartment(deptId);
    setNewSubject(prev => ({ ...prev, departmentId: deptId, courseId: '' }));
    const fetchCourses = async () => {
      try {
        const coursesSnapshot = await getDocs(collection(db, `departments/${deptId}/courses`));
        setCourses(coursesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        Swal.fire('Error', 'Failed to load courses', 'error');
      }
    };
    if (deptId) fetchCourses();
    else setCourses([]);
  };

  // Real-time listener for subjects with a 500ms delay for smoother updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      setTimeout(() => {
        setSubjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
      }, 500);
    });
    return () => unsubscribe();
  }, []);

  // Validation for the subject form
  const validateSubject = () => {
    const { subjectCode, subjectName, yearLevel, units, semester, departmentId, courseId } = newSubject;
    if (!subjectCode || !subjectName || !yearLevel || !units || !semester || !departmentId || !courseId) {
      Swal.fire('Warning', 'Please fill all required fields', 'warning');
      return false;
    }
    return true;
  };

  // Ensure the subject code is unique
  const checkUniqueSubjectCode = async (code: string) => {
    const q = query(collection(db, 'subjects'), where('subjectCode', '==', code));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  };

  // Create a new subject
  const handleCreateSubject = async () => {
    if (!validateSubject()) return;
    const isUnique = await checkUniqueSubjectCode(newSubject.subjectCode);
    if (!isUnique) {
      Swal.fire('Warning', 'Subject code must be unique', 'warning');
      return;
    }
    try {
      const subjectData: Subject = {
        ...newSubject,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'subjects'), subjectData);
      Swal.fire('Success', 'Subject created successfully', 'success');
      setNewSubject({
        subjectCode: '',
        subjectName: '',
        yearLevel: '',
        units: '',
        semester: '',
        departmentId: '',
        courseId: '',
      });
      setSelectedDepartment('');
      setCourses([]);
    } catch (error: any) {
      Swal.fire('Error', 'Failed to create subject', 'error');
    }
  };

  // Delete selected subjects (using external toolbar)
  const handleDeleteSubjects = async (subjectIds: string[]) => {
    if (subjectIds.length === 0) return;
    const confirmResult = await Swal.fire({
      title: 'Are you sure?',
      text: 'This action will permanently delete the selected subject(s).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete them!',
    });
    if (confirmResult.isConfirmed) {
      try {
        for (const id of subjectIds) {
          await deleteDoc(doc(db, 'subjects', id));
        }
        Swal.fire('Deleted!', 'Subject(s) have been deleted.', 'success');
      } catch (error: any) {
        Swal.fire('Error', 'Failed to delete subject(s)', 'error');
      }
    }
  };

  // Open edit modal with the selected subject
  const openEditModal = (subject: Subject) => {
    setEditSubject(subject);
    setIsEditModalOpen(true);
  };

  // Handle changes in the edit form
  const handleEditChange = (field: string, value: string) => {
    if (editSubject) {
      setEditSubject({ ...editSubject, [field]: value });
    }
  };

  // Update the subject document with new values
  const handleUpdateSubject = async () => {
    if (!editSubject || !editSubject.id) return;
    const { subjectCode, subjectName, yearLevel, units, semester, departmentId, courseId } = editSubject;
    if (!subjectCode || !subjectName || !yearLevel || !units || !semester || !departmentId || !courseId) {
      Swal.fire('Warning', 'Please fill all required fields', 'warning');
      return;
    }
    try {
      const subjectRef = doc(db, 'subjects', editSubject.id);
      await updateDoc(subjectRef, {
        subjectCode,
        subjectName,
        yearLevel,
        units,
        semester,
        departmentId,
        courseId,
      });
      Swal.fire('Success', 'Subject updated successfully', 'success');
      setIsEditModalOpen(false);
      setEditSubject(null);
    } catch (error: any) {
      Swal.fire('Error', 'Failed to update subject', 'error');
    }
  };

  // Helper: get department name
  const getDepartmentName = (deptId: string) => {
    return departments.find(dept => dept.id === deptId)?.name || 'N/A';
  };

  // Helper: get course name using allCourses
  const getCourseName = (courseId: string) => {
    return allCourses.find(course => course.id === courseId)?.name || 'N/A';
  };

  // For the edit modal, show courses for the subject's department from allCourses
  const getEditModalCourses = () => {
    if (!editSubject?.departmentId) return [];
    return allCourses.filter(course => course.departmentId === editSubject.departmentId);
  };

  // Filtering subjects based on filterDepartment and filterCourse
  const filteredSubjects = subjects.filter(sub => {
    return (!filterDepartment || sub.departmentId === filterDepartment) &&
           (!filterCourse || sub.courseId === filterCourse);
  });

  // DataTable columns definition (no action column)
  const columns = [
    {
      name: 'Subject Code',
      selector: (row: Subject) => row.subjectCode,
      sortable: true,
    },
    {
      name: 'Subject Name',
      selector: (row: Subject) => row.subjectName,
      sortable: true,
    },
    {
      name: 'Year Level',
      selector: (row: Subject) => row.yearLevel,
      sortable: true,
    },
    {
      name: 'Semester',
      selector: (row: Subject) => row.semester,
      sortable: true,
    },
    {
      name: 'Course',
      selector: (row: Subject) => (row.courseId ? getCourseName(row.courseId) : 'N/A'),
      sortable: true,
    },
  ];

  // Custom subheader (toolbar) for DataTable
  const SubHeaderComponent = () => {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => {
            if (selectedRows.length !== 1) {
              Swal.fire('Info', 'Please select exactly one subject to edit', 'info');
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
              Swal.fire('Info', 'Please select at least one subject to delete', 'info');
            } else {
              const ids = selectedRows.map((row: Subject) => row.id) as string[];
              handleDeleteSubjects(ids);
            }
          }}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faTrash} className="mr-2" /> Delete Selected
        </button>
        <button
          onClick={handleExport}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faFileExport} className="mr-2" /> Export
        </button>
        <button
          onClick={handleImport}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faFileImport} className="mr-2" /> Import
        </button>
      </div>
    );
  };

  // Row selection handler for DataTable
  const handleRowSelected = (state: any) => {
    setSelectedRows(state.selectedRows);
  };

  // Export function: group by yearLevel, semester, and course
  const handleExport = () => {
    if (filteredSubjects.length === 0) {
      Swal.fire('Info', 'No subjects to export', 'info');
      return;
    }
    // Group subjects by yearLevel, then semester, then course
    const grouped = filteredSubjects.reduce((acc: any, subject: Subject) => {
      const groupKey = `${subject.yearLevel} - ${subject.semester} - ${getCourseName(subject.courseId)}`;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(subject);
      return acc;
    }, {});
    // Create a workbook with each group as a separate sheet
    const workbook = XLSX.utils.book_new();
    Object.keys(grouped).forEach(groupKey => {
      const data = grouped[groupKey].map((sub: { subjectCode: any; subjectName: any; yearLevel: any; semester: any; courseId: string; createdAt: any; }) => ({
        'Subject Code': sub.subjectCode,
        'Subject Name': sub.subjectName,
        'Year Level': sub.yearLevel,
        'Semester': sub.semester,
        'Course': getCourseName(sub.courseId),
        'Created At': sub.createdAt,
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      // Limit sheet name to 31 characters
      XLSX.utils.book_append_sheet(workbook, worksheet, groupKey.substring(0, 31));
    });
    XLSX.writeFile(workbook, 'subjects_export.xlsx');
  };

  // Import function: read an Excel file and add subjects
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
      // For each row in the imported data, create a subject
      for (const row of jsonData) {
        // Validate required fields exist in row
        if (
          row['Subject Code'] &&
          row['Subject Name'] &&
          row['Year Level'] &&
          row['Units'] &&
          row['Semester'] &&
          row['Department'] &&
          row['Course']
        ) {
          // Find department and course id based on names (assumes unique names)
          const dept = departments.find(d => d.name === row['Department']);
          const course = allCourses.find(c => c.name === row['Course']);
          if (dept && course) {
            const subjectData: Subject = {
              subjectCode: row['Subject Code'],
              subjectName: row['Subject Name'],
              yearLevel: row['Year Level'],
              units: row['Units'],
              semester: row['Semester'],
              departmentId: dept.id,
              courseId: course.id,
              createdAt: new Date().toISOString(),
            };
            await addDoc(collection(db, 'subjects'), subjectData);
          }
        }
      }
      Swal.fire('Success', 'Subjects imported successfully', 'success');
    };
    input.click();
  };

  if (!ROLES[role]?.canManageSubjects) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h3 className="text-red-500">You don't have permission to manage subjects</h3>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Subject Form */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-primary mb-6">Subject Management</h2>
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={newSubject.subjectCode}
            onChange={(e) => setNewSubject({ ...newSubject, subjectCode: e.target.value })}
            placeholder="Subject Code"
            className="w-full p-3 border rounded-lg"
          />
          <input
            type="text"
            value={newSubject.subjectName}
            onChange={(e) => setNewSubject({ ...newSubject, subjectName: e.target.value })}
            placeholder="Subject Name"
            className="w-full p-3 border rounded-lg"
          />
          <input
            type="text"
            value={newSubject.yearLevel}
            onChange={(e) => setNewSubject({ ...newSubject, yearLevel: e.target.value })}
            placeholder="Year Level"
            className="w-full p-3 border rounded-lg"
          />
          <input
            type="text"
            value={newSubject.units}
            onChange={(e) => setNewSubject({ ...newSubject, units: e.target.value })}
            placeholder="Units/Credits"
            className="w-full p-3 border rounded-lg"
          />
          <input
            type="text"
            value={newSubject.semester}
            onChange={(e) => setNewSubject({ ...newSubject, semester: e.target.value })}
            placeholder="Semester"
            className="w-full p-3 border rounded-lg"
          />
          {/* Department Dropdown */}
          <select
            value={newSubject.departmentId}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            className="w-full p-3 border rounded-lg"
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
          {/* Course Dropdown (for create form) */}
          <select
            value={newSubject.courseId}
            onChange={(e) => setNewSubject({ ...newSubject, courseId: e.target.value })}
            className="w-full p-3 border rounded-lg"
            disabled={!newSubject.departmentId}
          >
            <option value="">Select Course</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.name} ({course.code})
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateSubject}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-accent-blue transition-colors"
          >
            Add Subject
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg flex flex-wrap gap-4 items-center">
        <h3 className="text-xl font-semibold text-primary">Filter Subjects:</h3>
        <select
          value={filterDepartment}
          onChange={(e) => { setFilterDepartment(e.target.value); setFilterCourse(''); }}
          className="p-2 border rounded"
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
        <select
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
          className="p-2 border rounded"
          disabled={!filterDepartment}
        >
          <option value="">All Courses</option>
          {allCourses
            .filter(course => course.departmentId === filterDepartment)
            .map(course => (
              <option key={course.id} value={course.id}>
                {course.name} ({course.code})
              </option>
          ))}
        </select>
      </div>

      {/* Data Table Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <DataTable
          columns={columns}
          data={filteredSubjects}
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
                fontWeight: 'bold',
                backgroundColor: '#f3f4f6', // Tailwind gray-100
              },
            },
          }}
        />
      </div>

      {/* Edit Subject Modal */}
      <AnimatePresence>
        {isEditModalOpen && editSubject && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="bg-white rounded-xl p-6 w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <h3 className="text-2xl font-bold mb-4">Edit Subject</h3>
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  value={editSubject.subjectCode}
                  onChange={(e) => handleEditChange('subjectCode', e.target.value)}
                  placeholder="Subject Code"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  value={editSubject.subjectName}
                  onChange={(e) => handleEditChange('subjectName', e.target.value)}
                  placeholder="Subject Name"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  value={editSubject.yearLevel}
                  onChange={(e) => handleEditChange('yearLevel', e.target.value)}
                  placeholder="Year Level"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  value={editSubject.units}
                  onChange={(e) => handleEditChange('units', e.target.value)}
                  placeholder="Units/Credits"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  value={editSubject.semester}
                  onChange={(e) => handleEditChange('semester', e.target.value)}
                  placeholder="Semester"
                  className="w-full p-3 border rounded-lg"
                />
                <select
                  value={editSubject.departmentId || ''}
                  onChange={(e) => handleEditChange('departmentId', e.target.value)}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                <select
                  value={editSubject.courseId || ''}
                  onChange={(e) => handleEditChange('courseId', e.target.value)}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="">Select Course</option>
                  {getEditModalCourses().map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end mt-6 gap-4">
                <button onClick={() => { setIsEditModalOpen(false); setEditSubject(null); }} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleUpdateSubject} className="bg-primary hover:bg-accent-blue text-white px-4 py-2 rounded-lg transition-colors">
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