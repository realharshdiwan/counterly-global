import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Check, KeyRound, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ManagerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: () => void;
  actionTitle?: string;
  actionDescription?: string;
}

export const ManagerOverrideModal: React.FC<ManagerOverrideModalProps> = ({
  isOpen,
  onClose,
  onAuthorized,
  actionTitle = 'Shift Lead Confirmation Required',
  actionDescription = 'Enter 6-digit Shift Lead or Store Admin PIN to confirm this counter action.',
}) => {
  const { checkManagerOverride } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);

      if (nextPin.length === 6) {
        verifyManagerPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const verifyManagerPin = async (pinToVerify: string) => {
    setIsSubmitting(true);
    try {
      const isApproved = await checkManagerOverride(pinToVerify);
      if (isApproved) {
        onAuthorized();
        onClose();
      } else {
        setError('Incorrect Lead or Admin PIN');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setTimeout(() => setPin(''), 600);
      }
    } catch {
      setError('Confirmation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E5E5E7] dark:border-zinc-800 flex flex-col items-center">
        
        {/* Top Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#E5E5E7] dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F5F5F7] dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-100 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#1D1D1F] dark:text-zinc-100">{actionTitle}</h3>
              <p className="text-[10px] text-[#86868B] dark:text-zinc-400">Shift Lead Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#515154] dark:text-zinc-400 text-center mt-3">
          {actionDescription}
        </p>

        {/* 6-Digit PIN Indicators */}
        <div className={`flex items-center justify-center gap-2.5 my-4 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map(index => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 border-2 ${
                  isFilled
                    ? 'bg-[#1D1D1F] dark:bg-zinc-100 border-[#1D1D1F] dark:border-zinc-100 scale-110 shadow-xs'
                    : 'bg-white dark:bg-zinc-900 border-[#E5E5E7] dark:border-zinc-700'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mb-2">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 10-Key Touchpad */}
        <div className="grid grid-cols-3 gap-2 w-full mt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigitClick(num)}
              disabled={isSubmitting}
              className="h-11 rounded-xl bg-[#F5F5F7] dark:bg-zinc-800 border border-[#E5E5E7] dark:border-zinc-700 text-lg font-bold text-[#1D1D1F] dark:text-zinc-100 hover:bg-[#E8E8ED] dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="h-11 rounded-xl bg-white dark:bg-zinc-800/60 border border-[#E5E5E7] dark:border-zinc-700 text-[11px] font-semibold text-[#86868B] dark:text-zinc-400 hover:bg-[#F5F5F7] dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-[#F5F5F7] dark:bg-zinc-800 border border-[#E5E5E7] dark:border-zinc-700 text-lg font-bold text-[#1D1D1F] dark:text-zinc-100 hover:bg-[#E8E8ED] dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-white dark:bg-zinc-800/60 border border-[#E5E5E7] dark:border-zinc-700 text-[11px] font-semibold text-[#86868B] dark:text-zinc-400 hover:bg-[#F5F5F7] dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer"
          >
            ⌫
          </button>
        </div>

        <div className="w-full flex items-center justify-between mt-4 pt-3 border-t border-[#E5E5E7] dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-[#E5E5E7] dark:border-zinc-700 text-xs font-semibold text-[#1D1D1F] dark:text-zinc-200 hover:bg-[#F5F5F7] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
