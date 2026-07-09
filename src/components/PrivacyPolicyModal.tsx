import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-4 top-[10vh] bottom-[10vh] z-[70] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden max-w-lg mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-black text-[#111827]">Privacy Policy</h2>
              <button onClick={onClose} aria-label="Close"
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-[13px] text-[#374151] leading-relaxed">
              <p className="text-[11px] text-gray-400">Last updated: July 2026</p>

              <section>
                <h3 className="font-bold text-[#111827] mb-1">What we collect</h3>
                <p>When you sign in with Google we receive your name, email address, and profile photo from Google OAuth. This information is stored in Firebase Firestore under your user account and is used solely to identify you within the app and to allow other users to invite you to shared spaces.</p>
              </section>

              <section>
                <h3 className="font-bold text-[#111827] mb-1">How we store your data</h3>
                <p>Note content, titles, and metadata are stored in Google Firebase Firestore. Files you attach (images, videos, voice recordings, documents) are uploaded to Firebase Storage — both services are operated by Google. Your data is stored in Google's infrastructure and subject to Google's own privacy and security practices.</p>
              </section>

              <section>
                <h3 className="font-bold text-[#111827] mb-1">Sharing &amp; collaboration</h3>
                <p>Spaces are private by default and only accessible to you and collaborators you explicitly invite. Invited collaborators can read your note content. Do not store sensitive personal data in shared spaces. We do not sell your data to third parties.</p>
              </section>

              <section>
                <h3 className="font-bold text-[#111827] mb-1">Space passwords</h3>
                <p>You can lock a space with a password. Passwords are hashed before being stored in Firestore — the original password is never saved. Do not reuse passwords from other services.</p>
              </section>

              <section>
                <h3 className="font-bold text-[#111827] mb-1">Cookies &amp; analytics</h3>
                <p>We use Firebase Analytics (optional) to understand usage patterns. No advertising cookies are set. You can disable analytics tracking in your browser settings.</p>
              </section>

              <section>
                <h3 className="font-bold text-[#111827] mb-1">Deletion</h3>
                <p>You can delete any space you own at any time from within the app. You can permanently delete your account and all associated data from the account menu. Deletion removes your notes, uploaded files, and your user profile from our systems.</p>
              </section>

              <section>
                <h3 className="font-bold text-[#111827] mb-1">Contact</h3>
                <p>Questions? Reach us at <a href="mailto:support@clipo.app" className="text-[#7C3AED] font-medium underline underline-offset-2">support@clipo.app</a></p>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
