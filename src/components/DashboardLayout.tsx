'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ROLES, Role } from '@/utils/roles';
import { auth } from '@/utils/firebase';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark, faCalendar, faUsers, faBook, faCog, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: Role;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

/** Map labels to actual permission keys */
const permissionKeys: Record<string, keyof typeof ROLES[Role]> = {
  Schedule: 'canManageSchedule',
  Approve: 'canApproveSchedule',
  Users: 'canManageUsers',
  Subjects: 'canManageSubjects',
  Calendar: 'canManageCalendar',
};

const navItems = [
  { id: 'schedule', icon: faCalendar, label: 'Schedule' },
  { id: 'approve', icon: faCheckCircle, label: 'Approve' },
  { id: 'users', icon: faUsers, label: 'Users' },
  { id: 'subjects', icon: faBook, label: 'Subjects' },
  { id: 'calendar', icon: faCog, label: 'Calendar' },
];

export default function DashboardLayout({ children, role, activeTab, setActiveTab }: DashboardLayoutProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  // Filter navigation based on user role permissions
  const filteredNavItems = navItems.filter(
    (item) => ROLES[role]?.[permissionKeys[item.label]] ?? false
  );

  const navVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
  };

  const mobileMenuVariants = {
    open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    closed: { x: '100%', transition: { duration: 0.2 } },
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-accent-blue text-white shadow-lg fixed w-full top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Section */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 flex-shrink-0">
              <Image src="/school-logo.png" alt="MCTI Logo" width={40} height={40} className="w-10 h-10 rounded-full shadow-md" />
              <span className="hidden lg:inline text-xl font-bold tracking-wide">
                Marvelous College of Technology Incorporated
              </span>
              <span className="lg:hidden text-xl font-bold">MCTI</span>
            </motion.div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-4 mx-6">
              {filteredNavItems.map((item) => (
                <motion.div key={item.id} variants={navVariants} initial="hidden" animate="visible">
                  <a
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeTab === item.id ? 'bg-white text-primary shadow-lg' : 'hover:bg-white/20'
                    }`}
                  >
                    <FontAwesomeIcon icon={item.icon} className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </a>
                </motion.div>
              ))}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="hidden md:block bg-secondary px-4 py-2 rounded-lg font-semibold hover:bg-accent-orange transition-colors"
              >
                Logout
              </motion.button>

              {/* Mobile Menu Button */}
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-white/20 focus:outline-none">
                <FontAwesomeIcon icon={isMenuOpen ? faXmark : faBars} className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.nav
              initial="closed"
              animate="open"
              exit="closed"
              variants={mobileMenuVariants}
              className="md:hidden absolute top-16 right-0 w-full bg-white shadow-xl"
            >
              <div className="px-4 py-2">
                {filteredNavItems.map((item) => (
                  <motion.div key={item.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mb-2">
                    <a
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors cursor-pointer ${
                        activeTab === item.id ? 'bg-primary text-white' : 'text-gray-800 hover:bg-gray-100'
                      }`}
                    >
                      <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </a>
                  </motion.div>
                ))}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-4 border-t border-gray-200 pt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-gray-900 rounded-lg font-semibold hover:bg-accent-orange"
                  >
                    Logout
                  </button>
                </motion.div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 mt-16 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
