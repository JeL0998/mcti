// utils/roles.ts

export type Role = 'admin' | 'registrar' | 'dept_head' | 'teacher';

interface RolePermissions {
  canManageUsers: boolean;
  canManageAllDepartments: boolean;
  canManageSubjects: boolean;
  canManageSchedule: boolean;
  canManageCalendar: boolean;
  canApproveSchedule: boolean;
  restrictedRoles?: string[]; // Optional property
  allowedRoles?: string[];    // Optional property
}

export const getUserRoleOptions = (currentUserRole: Role) => {
  const options: Role[] = [];
  
  switch(currentUserRole) {
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

export const canEditUser = (currentUserRole: Role, targetUserRole: Role) => {
  if (currentUserRole === 'admin') return true;
  if (currentUserRole === 'registrar' && targetUserRole !== 'admin') return true;
  if (currentUserRole === 'dept_head' && targetUserRole === 'teacher') return true;
  return false;
};

export const ROLES: Record<Role, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canManageAllDepartments: true,
    canManageSubjects: true,
    canManageSchedule: true,
    canManageCalendar: true,
    canApproveSchedule: true,
  },
  registrar: {
    canManageUsers: true,
    canManageAllDepartments: false,
    canManageSubjects: true,
    canManageSchedule: true,
    canManageCalendar: true,
    canApproveSchedule: true,
    restrictedRoles: ['admin'], // Cannot manage admin accounts
  },
  dept_head: {
    canManageUsers: true,
    canManageAllDepartments: false,
    canManageSubjects: true,
    canManageSchedule: true,
    canManageCalendar: false,
    canApproveSchedule: true,
    allowedRoles: ['teacher'], // Can only manage teachers
  },
  teacher: {
    canManageUsers: false,
    canManageAllDepartments: false,
    canManageSubjects: false,
    canManageSchedule: false,
    canManageCalendar: false,
    canApproveSchedule: true,
  },
};
