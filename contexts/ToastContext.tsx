import React, { createContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

interface ToastContextType {
  showToast: (message: string, options?: { type?: ToastType; title?: string }) => void;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, options?: { type?: ToastType; title?: string }) => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts((prev) => [...prev, { id, message, type: options?.type || 'info', title: options?.title }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, toasts, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full sm:w-auto">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden pointer-events-auto"
              style={{ boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -5px rgba(0, 0, 0, 0.05)' }}
            >
              <div className="flex items-start p-4 bg-white">
                <div className="flex-shrink-0 mr-3 mt-0.5">
                  {getIcon(toast.type)}
                </div>
                <div className="flex-grow min-w-0 pr-4">
                  {toast.title && (
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-1">
                      {toast.title}
                    </h3>
                  )}
                  <p className={`text-sm leading-normal ${toast.title ? 'text-gray-600' : 'text-gray-800 font-medium'}`}>
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div 
                className={`h-1 w-full opacity-50 ${
                  toast.type === 'success' ? 'bg-green-500' : 
                  toast.type === 'error' ? 'bg-red-500' : 
                  'bg-blue-500'
                }`}
                style={{
                  animation: 'shrink 5s linear forwards'
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
