import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const SignInPage: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user') setError('Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(circle, #9CA3AF 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 w-[420px] h-[420px] rounded-full bg-indigo-900/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/60 via-transparent to-[#FAF9F5]/80" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm flex flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="mb-5 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: 'spring', damping: 18, stiffness: 280 }}
        >
          <span className="text-white font-black text-3xl leading-none">C</span>
        </motion.div>

        <motion.h1 className="text-4xl font-black text-[#111827] tracking-tight leading-none mb-1.5"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          Clipo
        </motion.h1>

        <motion.p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280] mb-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
          Collaborative Spaces
        </motion.p>

        <motion.p className="text-sm text-[#6B7280] leading-relaxed mb-10 max-w-[280px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
          Create a shared space and a lot more for all your jotting down needs.
        </motion.p>

        {/* Google sign-in button */}
        <motion.button
          onClick={handleGoogle}
          disabled={loading}
          aria-label="Sign in with Google"
          className="w-full h-14 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center justify-center gap-3 text-sm font-semibold text-[#111827] hover:bg-gray-50 hover:shadow-md transition-all disabled:opacity-60"
          whileTap={{ scale: loading ? 1 : 0.98 }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </motion.button>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-3 text-xs text-red-500 font-medium">
            {error}
          </motion.p>
        )}
      </motion.div>

      {/* Footer */}
      <motion.div
        className="relative z-10 mt-12 flex items-center justify-center gap-3 text-[10px] text-[#9CA3AF]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}
      >
        <button onClick={() => setShowPrivacy(true)} className="hover:text-[#6B7280] transition-colors">Privacy Policy</button>
        <span>·</span>
        <span>Made with ♥ by Ravi</span>
      </motion.div>

      <PrivacyPolicyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
};

export default SignInPage;
