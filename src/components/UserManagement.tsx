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
import bcrypt from 'bcryptjs';
import { Role, ROLES } from '@/utils/roles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEye,
  faEyeSlash,
  faEdit,
  faTrash,
  faFileExport,
  faFileImport,
} from '@fortawesome/free-solid-svg-icons';

const ROLE_NAMES: Record<Role, string> = {
  admin: 'Administrator',
  registrar: 'Registrar',
  dept_head: 'Department Head',
  teacher: 'Teacher'
};

interface User {
  id?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  departmentId?: string;
  password: string;
  createdAt: string;
}

export default function UserManagement({ currentUserRole, currentUserDepartment }: { currentUserRole: Role, currentUserDepartment: string }) {
  // State variables
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'teacher' as Role,
    departmentId: '',
    password: '',
  });
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Filter states
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  // Selected rows from DataTable
  const [selectedRows, setSelectedRows] = useState<User[]>([]);

  // Fetch departments and users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const deptSnapshot = await getDocs(collection(db, 'departments'));
        setDepartments(deptSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));

        const userSnapshot = await getDocs(collection(db, 'users'));
        setUsers(userSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      } catch (error) {
        Swal.fire('Error', 'Failed to load data', 'error');
      }
      setLoading(false);
    };

    if (ROLES[currentUserRole]?.canManageUsers) fetchData();
  }, [currentUserRole]);

  // Real-time listener for users with a 500ms delay for smoother updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setTimeout(() => {
        setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      }, 500);
    });
    return () => unsubscribe();
  }, []);

  // Get eligible roles based on current user’s role
  const getEligibleRoles = () => {
    if (currentUserRole === 'admin') return ['admin', 'registrar', 'dept_head', 'teacher'];
    if (currentUserRole === 'registrar') return ['registrar', 'dept_head', 'teacher'];
    if (currentUserRole === 'dept_head') return ['teacher'];
    return [];
  };

  // Basic email validation
  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  // Create a new user (hashing password)
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.firstName || !newUser.lastName || !newUser.password) {
      Swal.fire('Warning', 'Please fill all required fields', 'warning');
      return;
    }
    if (!validateEmail(newUser.email)) {
      Swal.fire('Warning', 'Please enter a valid email address', 'warning');
      return;
    }
    if (newUser.password.length < 6) {
      Swal.fire('Warning', 'Password must be at least 6 characters long', 'warning');
      return;
    }
    if ((newUser.role === 'dept_head' || newUser.role === 'teacher') && !newUser.departmentId) {
      Swal.fire('Warning', 'Please select a department for this role', 'warning');
      return;
    }
    try {
      const hashedPassword = await bcrypt.hash(newUser.password, 10);
      const userData: User = {
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        departmentId: (newUser.role === 'dept_head' || newUser.role === 'teacher') ? newUser.departmentId : '',
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'users'), userData);
      Swal.fire('Success', 'User created successfully', 'success');
      setNewUser({ username: '', email: '', firstName: '', lastName: '', role: 'teacher', departmentId: '', password: '' });
    } catch (error: any) {
      Swal.fire('Error', 'Failed to create user', 'error');
    }
  };

  // Delete a user
  const handleDeleteUser = async (userId?: string) => {
    if (!userId) return;
    const confirmResult = await Swal.fire({
      title: 'Are you sure?',
      text: 'This action will permanently delete the user.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
    });
    if (confirmResult.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        Swal.fire('Deleted!', 'User has been deleted.', 'success');
      } catch (error: any) {
        Swal.fire('Error', 'Failed to delete user', 'error');
      }
    }
  };

  // Open edit modal with selected user
  const openEditModal = (user: User) => {
    setEditUser(user);
    setIsEditModalOpen(true);
  };

  // Handle changes in the edit form
  const handleEditUserChange = (field: string, value: string) => {
    if (editUser) {
      setEditUser({ ...editUser, [field]: value });
    }
  };

  // Update user document with edited fields (password remains unchanged)
  const handleUpdateUser = async () => {
    if (!editUser || !editUser.id) return;
    if (!editUser.username || !editUser.email || !editUser.firstName || !editUser.lastName) {
      Swal.fire('Warning', 'Please fill all required fields', 'warning');
      return;
    }
    if (!validateEmail(editUser.email)) {
      Swal.fire('Warning', 'Please enter a valid email address', 'warning');
      return;
    }
    try {
      const userRef = doc(db, 'users', editUser.id);
      await updateDoc(userRef, {
        username: editUser.username,
        email: editUser.email,
        firstName: editUser.firstName,
        lastName: editUser.lastName,
        role: editUser.role,
        departmentId: (editUser.role === 'dept_head' || editUser.role === 'teacher') ? editUser.departmentId : '',
      });
      Swal.fire('Success', 'User updated successfully', 'success');
      setIsEditModalOpen(false);
      setEditUser(null);
    } catch (error: any) {
      Swal.fire('Error', 'Failed to update user', 'error');
    }
  };

  // Helper to get department name
  const getDepartmentName = (deptId: string) => {
    return departments.find(d => d.id === deptId)?.name || 'N/A';
  };

  // Filter users based on filterDepartment and filterRole
  const filteredUsers = users.filter(user => {
    return (!filterDepartment || user.departmentId === filterDepartment) &&
      (!filterRole || user.role === filterRole);
  });

  // DataTable columns definition for user management
  const columns = [
    {
      name: 'Username',
      selector: (row: User) => row.username,
      sortable: true,
    },
    {
      name: 'Email',
      selector: (row: User) => row.email,
      sortable: true,
    },
    {
      name: 'Name',
      selector: (row: User) => `${row.firstName} ${row.lastName}`,
      sortable: true,
    },
    {
      name: 'Role',
      selector: (row: User) => row.role,
      sortable: true,
    },
    {
      name: 'Department',
      selector: (row: User) => (row.departmentId ? getDepartmentName(row.departmentId) : 'N/A'),
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
              Swal.fire('Info', 'Please select exactly one user to edit', 'info');
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
              Swal.fire('Info', 'Please select at least one user to delete', 'info');
            } else {
              const ids = selectedRows.map((row: User) => row.id) as string[];
              ids.forEach((id) => handleDeleteUser(id));
            }
          }}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faTrash} className="mr-2" /> Delete Selected
        </button>
        <button
          onClick={handleExportUsers}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faFileExport} className="mr-2" /> Export
        </button>
        <button
          onClick={handleImportUsers}
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

  // Export function: group by role and department
  const handleExportUsers = () => {
    if (filteredUsers.length === 0) {
      Swal.fire('Info', 'No users to export', 'info');
      return;
    }
    const grouped = filteredUsers.reduce((acc: any, user: User) => {
      const groupKey = `${user.role} - ${user.departmentId ? getDepartmentName(user.departmentId) : 'N/A'}`;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(user);
      return acc;
    }, {});
    const workbook = XLSX.utils.book_new();
    Object.keys(grouped).forEach((groupKey) => {
      const data = grouped[groupKey].map((user: User) => ({
        Username: user.username,
        Email: user.email,
        Name: `${user.firstName} ${user.lastName}`,
        Role: user.role,
        Department: user.departmentId ? getDepartmentName(user.departmentId) : 'N/A',
        'Created At': user.createdAt,
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, groupKey.substring(0, 31));
    });
    XLSX.writeFile(workbook, 'users_export.xlsx');
  };

  // Import function: read an Excel file and add users
  const handleImportUsers = async () => {
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
      for (const row of jsonData) {
        if (
          row['Username'] &&
          row['Email'] &&
          row['Name'] &&
          row['Role'] &&
          row['Department']
        ) {
          const [firstName, ...rest] = row['Name'].split(' ');
          const lastName = rest.join(' ');
          const dept = departments.find((d) => d.name === row['Department']);
          if (dept) {
            const userData: User = {
              username: row['Username'],
              email: row['Email'],
              firstName,
              lastName,
              role: row['Role'],
              departmentId: dept.id,
              password: '', // Imported users need to reset their password
              createdAt: new Date().toISOString(),
            };
            await addDoc(collection(db, 'users'), userData);
          }
        }
      }
      Swal.fire('Success', 'Users imported successfully', 'success');
    };
    input.click();
  };

  // Custom styles for DataTable
  const customStyles = {
    headCells: {
      style: {
        fontWeight: 'bold',
        backgroundColor: '#f3f4f6',
      },
    },
  };

  if (!ROLES[currentUserRole]?.canManageUsers) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h3 className="text-red-500">You don't have permission to manage users</h3>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* User Form */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-primary mb-6">User Management</h2>
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            placeholder="Username"
            className="w-full p-3 border rounded-lg"
          />
          <input
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="Email"
            className="w-full p-3 border rounded-lg"
          />
          <input
            type="text"
            value={newUser.firstName}
            onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
            placeholder="First Name"
            className="w-full p-3 border rounded-lg"
          />
          <input
            type="text"
            value={newUser.lastName}
            onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
            placeholder="Last Name"
            className="w-full p-3 border rounded-lg"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Password"
              className="w-full p-3 border rounded-lg pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="text-gray-500" />
            </button>
          </div>
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
            className="w-full p-3 border rounded-lg"
          >
            {getEligibleRoles().map((r) => (
              <option key={r} value={r}>
                {ROLE_NAMES[r as Role]}
              </option>
            ))}
          </select>
          {(newUser.role === 'dept_head' || newUser.role === 'teacher') && (
            <>
              {currentUserRole === 'dept_head' ? (
                // If the logged-in user is a department head, lock the department selection
                <select
                  value={currentUserDepartment}
                  disabled
                  className="w-full p-3 border rounded-lg"
                >
                  <option value={currentUserDepartment}>
                    {currentUserDepartment === 'non_board_courses'
                      ? 'Non Board Courses'
                      : 'Board Courses'}
                  </option>
                </select>
              ) : (
                // Otherwise, allow selection from all departments
                <select
                  value={newUser.departmentId}
                  onChange={(e) =>
                    setNewUser({ ...newUser, departmentId: e.target.value })
                  }
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <button
            onClick={handleCreateUser}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-accent-blue transition-colors"
          >
            Add User
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg flex flex-wrap gap-4 items-center">
        <h3 className="text-xl font-semibold text-primary">Filter Users:</h3>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">All Roles</option>
          {getEligibleRoles().map((r) => (
            <option key={r} value={r}>
              {ROLE_NAMES[r as Role]}
            </option>
          ))}
        </select>
      </div>

      {/* Data Table Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <DataTable
          columns={columns}
          data={filteredUsers}
          pagination
          responsive
          highlightOnHover
          selectableRows
          onSelectedRowsChange={handleRowSelected}
          subHeader
          subHeaderComponent={<SubHeaderComponent />}
          customStyles={customStyles}
        />
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {isEditModalOpen && editUser && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl p-6 w-full max-w-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <h3 className="text-2xl font-bold mb-4">Edit User</h3>
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  value={editUser.username}
                  onChange={(e) => handleEditUserChange('username', e.target.value)}
                  placeholder="Username"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => handleEditUserChange('email', e.target.value)}
                  placeholder="Email"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  value={editUser.firstName}
                  onChange={(e) => handleEditUserChange('firstName', e.target.value)}
                  placeholder="First Name"
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  value={editUser.lastName}
                  onChange={(e) => handleEditUserChange('lastName', e.target.value)}
                  placeholder="Last Name"
                  className="w-full p-3 border rounded-lg"
                />
                <select
                  value={editUser.role}
                  onChange={(e) => handleEditUserChange('role', e.target.value)}
                  className="w-full p-3 border rounded-lg"
                >
                  {getEligibleRoles().map((r) => (
                    <option key={r} value={r}>
                      {ROLE_NAMES[r as Role]}
                    </option>
                  ))}
                </select>
                {(editUser.role === 'dept_head' || editUser.role === 'teacher') && (
                  <>
                    {currentUserRole === 'dept_head' ? (
                      <select
                        value={currentUserDepartment}
                        disabled
                        className="w-full p-3 border rounded-lg"
                      >
                        <option value={currentUserDepartment}>
                          {currentUserDepartment === 'non_board_courses'
                            ? 'Non Board Courses'
                            : 'Board Courses'}
                        </option>
                      </select>
                    ) : (
                      <select
                        value={editUser.departmentId || ''}
                        onChange={(e) => handleEditUserChange('departmentId', e.target.value)}
                        className="w-full p-3 border rounded-lg"
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end mt-6 gap-4">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditUser(null);
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="bg-primary hover:bg-accent-blue text-white px-4 py-2 rounded-lg transition-colors"
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
