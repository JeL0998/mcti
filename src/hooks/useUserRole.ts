import { useState, useEffect } from 'react';
import { Role } from '@/utils/roles';

export function useUserRole() {
  const [role, setRole] = useState<Role | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setRole(parsedUser.role);
      setDepartmentId(parsedUser.departmentId);
      setUserId(parsedUser.userId);
    } else {
      setRole(null);
      setDepartmentId(null);
      setUserId(null);
    }
    setLoading(false);
  }, []);

  return { role, departmentId, userId, loading };
}
