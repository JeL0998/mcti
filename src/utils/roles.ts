export type Role = 'admin' | 'registrar' | 'dept_head' | 'teacher';

interface RolePermissions {
  canManageUsers: boolean;
  canManageAllDepartments: boolean;
  canManageSubjects: boolean;
  canManageSchedule: boolean;
  canManageCalendar: boolean;
  canApproveSchedule: boolean;
  restrictedRoles?: string[];
  allowedRoles?: string[];
}

export const getUserRoleOptions = (currentUserRole: Role, currentUserDept?: string) => {
  const options: Role[] = [];

  switch (currentUserRole) {
    case 'admin':
      return Object.keys(ROLES) as Role[];
    case 'registrar':
      return ['registrar', 'dept_head', 'teacher'];
    case 'dept_head':
      return ['teacher'];
    default:
      return [];
  }
};

export const canEditUser = (currentUserRole: Role, targetUserRole: Role, currentUserDept?: string, targetUserDept?: string) => {
  if (currentUserRole === 'admin') return true;
  if (currentUserRole === 'registrar' && targetUserRole !== 'admin') return true;
  
  if (currentUserRole === 'dept_head') {
    // Dept head can only manage teachers in their department
    return targetUserRole === 'teacher' && currentUserDept === targetUserDept;
  }

  return false;
};

export const ROLES: Record<Role, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canManageAllDepartments: true,
    canManageSubjects: true,
    canManageSchedule: true,
    canManageCalendar: true,
    canApproveSchedule: false,
  },
  registrar: {
    canManageUsers: true,
    canManageAllDepartments: false,
    canManageSubjects: true,
    canManageSchedule: true,
    canManageCalendar: true,
    canApproveSchedule: false,
    restrictedRoles: ['admin'], // Cannot manage admin accounts
  },
  dept_head: {
    canManageUsers: true,
    canManageAllDepartments: false,
    canManageSubjects: true,
    canManageSchedule: true,
    canManageCalendar: false,
    canApproveSchedule: false,
    allowedRoles: ['teacher'], // Can only manage teachers
  },
  teacher: {
    canManageUsers: false,
    canManageAllDepartments: false,
    canManageSubjects: true,
    canManageSchedule: false,
    canManageCalendar: true,
    canApproveSchedule: true,
  },
};
