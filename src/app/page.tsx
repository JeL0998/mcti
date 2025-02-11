'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faCircleQuestion, faUserShield, faPaperPlane, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import LoadingSpinner from '@/components/LoadingSpinner';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import bcrypt from 'bcryptjs';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 120 }
  }
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Query Firestore for the user with the given username
      const q = query(collection(db, 'users'), where('username', '==', username));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        throw new Error('User not found');
      }
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Compare the provided password with the hashed password stored in Firestore
      const isMatch = await bcrypt.compare(password, userData.password);
      if (!isMatch) {
        throw new Error('Invalid password');
      }

      // If login is successful, store user data in localStorage
      localStorage.setItem('user', JSON.stringify(userData));
      router.push('/dashboard');
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: error.message || 'Invalid username or password',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactAdmin = () => {
    Swal.fire({
      icon: 'success',
      title: 'Message Sent!',
      text: 'The admin will contact you shortly',
    });
    setShowContactAdmin(false);
    setMessage('');
  };

  if (!isMounted) return null;

  return (
    <div>
      {isLoading && <LoadingSpinner />}
      <div className="min-h-screen bg-gradient-to-br from-primary via-accent-blue to-light-accent flex items-center justify-center p-4">
        <motion.div
          key="login-container"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120 }}
          className="w-full max-w-4xl bg-white/90 backdrop-blur-lg rounded-3xl shadow-3d-primary overflow-hidden grid grid-cols-1 lg:grid-cols-2"
        >
          {/* Left Side - Login Form */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="p-10 border-r border-gray-100"
          >
            <motion.div variants={itemVariants} className="mb-10 text-center">
              <motion.div
                className="group relative p-4 rounded-3xl bg-gradient-to-br from-primary/10 to-accent-blue/10 hover:to-accent-blue/20 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="relative overflow-hidden rounded-2xl">
                  {/* Animated gradient background */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent-blue/20 opacity-0 group-hover:opacity-100"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0 }}
                    whileHover={{ opacity: 1, transition: { duration: 0.4 } }}
                  />
                  {/* Shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%', transition: { duration: 0.6, repeatDelay: 1 } }}
                  />
                  {/* Main logo */}
                  <motion.img
                    src="/school-logo.png"
                    alt="MCTI Logo"
                    className="w-32 h-32 mx-auto mb-6 cursor-pointer relative z-10 bg-white rounded-2xl p-2 shadow-lg"
                    initial={{ rotate: 0, scale: 1, y: 0 }}
                    animate={{ y: [-4, 0, -4], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
                    whileHover={{
                      rotate: 360,
                      scale: 1.1,
                      transition: {
                        rotate: { duration: 1.2, ease: 'linear' },
                        scale: { type: 'spring', stiffness: 300 }
                      }
                    }}
                    whileTap={{ scale: 0.95, rotate: 180, transition: { duration: 0.3 } }}
                    transition={{ default: { duration: 0.3, ease: 'easeInOut' } }}
                  />
                </div>
                <motion.div
                  className="absolute inset-0 border-2 border-primary/20 rounded-3xl"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1, borderColor: '#148DD9', transition: { duration: 0.4 } }}
                />
                <h1 className="text-3xl font-bold text-primary">MCTI Faculty Portal</h1>
                <p className="text-gray-600 mt-2">Sign in to manage your schedule</p>
              </motion.div>
            </motion.div>

            <motion.form onSubmit={handleLogin} className="space-y-6" variants={containerVariants}>
              <motion.div variants={itemVariants}>
                <div className="relative group">
                  <FontAwesomeIcon
                    icon={faEnvelope}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-blue group-hover:text-primary transition-colors"
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 group-hover:border-accent-blue"
                    placeholder="Username"
                    required
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <div className="relative group">
                  <FontAwesomeIcon
                    icon={faLock}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-blue group-hover:text-primary transition-colors"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 group-hover:border-accent-blue"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <motion.button
                  whileHover={!isLoading ? { scale: 1.02, boxShadow: '0 10px 20px -10px rgba(0, 91, 150, 0.4)' } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                  type="submit"
                  disabled={isLoading}
                  className={`w-full bg-primary hover:bg-accent-blue text-white py-4 rounded-xl transition-all duration-300 font-semibold flex items-center justify-center gap-2 ${
                    isLoading ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="text-lg" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <motion.div animate={{ x: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                        →
                      </motion.div>
                    </>
                  )}
                </motion.button>
              </motion.div>

              <motion.div variants={itemVariants} className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowContactAdmin(true)}
                  className="text-secondary hover:text-accent-orange transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faUserShield} />
                  Contact Admin
                </button>
              </motion.div>
            </motion.form>
          </motion.div>

          {/* Right Side - Interactive Preview */}
          {isMounted && (
            <div className="hidden lg:block bg-gradient-to-br from-primary to-accent-blue p-10 relative">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="h-full flex flex-col justify-center items-center text-white text-center"
              >
                <motion.div animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 6 }} className="mb-8">
                  <FontAwesomeIcon icon={faPaperPlane} className="text-6xl mb-4 opacity-90" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-4">New to MCTI?</h2>
                <p className="mb-6 opacity-90">Contact system administrator to create your faculty account</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowContactAdmin(true)}
                  className="px-8 py-3 bg-white/10 backdrop-blur-sm rounded-xl border-2 border-white/20 hover:border-white/40 transition-all"
                >
                  Request Account
                </motion.button>
              </motion.div>
            </div>
          )}

          {/* Modals */}
          <AnimatePresence>
            {showContactAdmin && (
              <motion.div
                key="contact-admin-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
              >
                <motion.div initial={{ scale: 0.9, rotate: -2 }} animate={{ scale: 1, rotate: 0 }} className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl relative">
                  <button onClick={() => setShowContactAdmin(false)} className="absolute top-4 right-4 text-gray-500 hover:text-primary">
                    ×
                  </button>
                  <div className="text-center mb-6">
                    <FontAwesomeIcon icon={faUserShield} className="text-4xl text-primary mb-4" />
                    <h3 className="text-2xl font-bold text-primary">Contact Administrator</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Message</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all h-32"
                        placeholder="Describe your account needs..."
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleContactAdmin}
                      className="w-full bg-secondary hover:bg-accent-orange text-white py-3 rounded-xl transition-all font-semibold flex items-center justify-center gap-2"
                    >
                      <FontAwesomeIcon icon={faPaperPlane} />
                      Send Message
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
