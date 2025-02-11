'use client';
import { motion } from 'framer-motion';
import { auth } from '@/utils/firebase';
import { Role } from '@/utils/roles';
import { useRouter } from 'next/navigation';

export default function Header({ role }: { role: Role }) {
  const router = useRouter();

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-primary text-white shadow-lg py-4 px-6 flex justify-between items-center"
    >
      <div className="text-lg md:text-2xl font-bold tracking-wide">
        Marvelous College of Technology Incorporated (MCTI)
      </div>
      <div className="flex items-center gap-4">
        <motion.div
          className="hidden md:block px-4 py-2 bg-white/20 rounded-lg text-sm font-semibold backdrop-blur-md"
          whileHover={{ scale: 1.05 }}
        >
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 transition-colors rounded-lg text-white font-semibold"
        >
          Logout
        </motion.button>
      </div>
    </motion.header>
  );
}
