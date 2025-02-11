import { useState, useEffect } from 'react';
import { Role } from '@/utils/roles';

export function useUserRole() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setRole(parsedUser.role);
    } else {
      setRole(null);
    }
    setLoading(false);
  }, []);

  return { role, loading };
}
