import React, { createContext, useContext, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info';
  copyValue?: string;
}

interface ConfirmData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface UIContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', copyValue?: string) => void;
  showConfirm: (data: ConfirmData) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirm, setConfirm] = useState<ConfirmData | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Auto-hide toast (longer when it has a copy button)
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), toast.copyValue ? 6000 : 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', copyValue?: string) => {
    setToast({ message, type, copyValue });
  };

  const showConfirm = (data: ConfirmData) => {
    setConfirm(data);
    setIsConfirmOpen(true);
  };

  const handleConfirmAction = () => {
    if (confirm) {
      confirm.onConfirm();
    }
    setIsConfirmOpen(false);
  };

  const handleCancelAction = () => {
    if (confirm && confirm.onCancel) {
      confirm.onCancel();
    }
    setIsConfirmOpen(false);
  };

  return (
    <UIContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* 1. CUSTOM FLOATING TOAST NOTIFICATION */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none max-w-sm w-full px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-[#111827] text-white rounded-2xl p-4 shadow-soft-xl flex items-center gap-3 border border-white/10 pointer-events-auto text-left"
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-clipo-success shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-clipo-error shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-violet-300 shrink-0" />}
              
              <span className="text-xs font-semibold leading-relaxed flex-1">
                {toast.message}
              </span>

              {toast.copyValue && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(toast.copyValue!);
                    setToast(prev => prev ? { ...prev, message: 'Copied!', copyValue: undefined } : null);
                  }}
                  className="shrink-0 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold transition-colors"
                >
                  Copy
                </button>
              )}

              <button
                onClick={() => setToast(null)}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. CUSTOM CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {isConfirmOpen && confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelAction}
              className="fixed inset-0 bg-[#000000]/30 backdrop-blur-[2.5px]"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-[#FFFFFF] rounded-clipo-card border border-clipo-border shadow-soft-xl overflow-hidden z-10 p-6 flex flex-col gap-5 text-left"
            >
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-bold text-clipo-text-primary">
                  {confirm.title}
                </h3>
                <p className="text-xs text-clipo-text-secondary leading-relaxed">
                  {confirm.message}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <Button 
                  variant="ghost" 
                  onClick={handleCancelAction}
                  size="sm"
                  className="text-xs font-semibold h-9 px-4"
                >
                  {confirm.cancelLabel || "Cancel"}
                </Button>
                <Button 
                  variant={confirm.isDanger ? "danger" : "primary"}
                  onClick={handleConfirmAction}
                  size="sm"
                  className="text-xs font-bold h-9 px-4"
                >
                  {confirm.confirmLabel || "Confirm"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </UIContext.Provider>
  );
};

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
