// DashboardPage.tsx
'use client';
import { useState, useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import UserManagement from '@/components/UserManagement';
import SubjectManagement from '@/components/SubjectManagement';
import ScheduleManagement from '@/components/ScheduleManagement';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/LoadingSpinner';
import DashboardLayout from '@/components/DashboardLayout';
import CalendarManagement from '@/components/CalendarManagement';

export default function DashboardPage() {
  const { role, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState('schedule');
  const router = useRouter();

  useEffect(() => {
    if (!loading && !role) router.push('/');
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
        {activeTab === 'users' && <UserManagement currentUserRole={role} />}
        {activeTab === 'subjects' && <SubjectManagement role={role} />}
        {activeTab === 'schedule' && <ScheduleManagement role={role} />}
        {activeTab === 'calendar' && <CalendarManagement currentUser={{ role }}/>}
      </motion.div>
    </DashboardLayout>
  );
}
