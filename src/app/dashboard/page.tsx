// DashboardPage.tsx
'use client';
import { useState, useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import UserManagement from '@/components/UserManagement';
import SubjectManagement from '@/components/SubjectManagement';
import ScheduleManagement from '@/components/ScheduleManagement';
import ApproveScheduleManagement from '@/components/ApproveScheduleManagement';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/LoadingSpinner';
import DashboardLayout from '@/components/DashboardLayout';
import CalendarManagement from '@/components/CalendarManagement';

export default function DashboardPage() {
  // Assume useUserRole returns role, departmentId, userId and loading.
  const { role, departmentId, userId, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState('schedule');
  const router = useRouter();

  useEffect(() => {
    if (!loading && !role) router.push('/');
    if (!loading && role === 'teacher') {
      setActiveTab('approve');
    }
  }, [role, loading, router]);

  if (loading || !role) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.5 }}
          className="text-lg font-bold text-gray-700 flex flex-col items-center"
        >
          <LoadingSpinner />
          <p className="mt-3 text-gray-600">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <DashboardLayout role={role} activeTab={activeTab} setActiveTab={setActiveTab}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {activeTab === 'users' && (
          <UserManagement currentUserRole={role} currentUserDepartment={departmentId ?? ''} />
        )}
        {activeTab === 'subjects' && (
          <SubjectManagement currentUserRole={role} currentUserDepartment={departmentId ?? ''} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleManagement currentUserRole={role} currentUserDepartment={departmentId ?? ''} />
        )}
        {activeTab === 'approve' && role === 'teacher' && userId && (
          <ApproveScheduleManagement currentUserRole={role} currentUserId={userId ?? ''} />
        )}
        {activeTab === 'calendar' && (
          <CalendarManagement currentUser={{ role }}/>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
