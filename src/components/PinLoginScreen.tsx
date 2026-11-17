import React, { useState, useEffect } from 'react';
import { Delete, ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../db/db';

interface PinLoginScreenProps {
  onSuccess?: () => void;
}

export const PinLoginScreen: React.FC<PinLoginScreenProps> = ({ onSuccess }) => {
  const { loginWithPin } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [storeName, setStoreName] = useState<string>('');
  const secretTapRef = React.useRef<{ count: number; timer: number | null }>({ count: 0, timer: null });

  const handleBrandTap = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      window.dispatchEvent(new CustomEvent('counterly:open-vendor'));
      return;
    }
    secretTapRef.current.count += 1;
    if (secretTapRef.current.timer) window.clearTimeout(secretTapRef.current.timer);
    if (secretTapRef.current.count >= 5) {
      secretTapRef.current.count = 0;
      window.dispatchEvent(new CustomEvent('counterly:open-vendor'));
      return;
    }
    secretTapRef.current.timer = window.setTimeout(() => {
      secretTapRef.current.count = 0;
    }, 1800);
  };

  useEffect(() => {
    db.shop_config.toArray().then(cfgs => {
      if (cfgs.length > 0 && cfgs[0].legal_name) {
        setStoreName(cfgs[0].legal_name);
      }
    });
  }, []);

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);

      // Auto-submit when 6 digits are entered
      if (nextPin.length === 6) {
        verifyPin(nextPin);
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

  const verifyPin = async (pinToVerify: string) => {
    setIsSubmitting(true);
    try {
      const res = await loginWithPin(pinToVerify);
      if (res.success) {
        setPin('');
        setError(null);
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || 'Incorrect 6-Digit PIN');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setTimeout(() => setPin(''), 600);
      }
    } catch (err) {
      setError('Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard support for hardware numpad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F5F7] dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Container Box */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#E5E5E7] dark:border-zinc-800 shadow-xl max-w-sm w-full p-6 sm:p-8 flex flex-col items-center">
        
        {/* Brand Header */}
        <div onClick={handleBrandTap} className="text-center mb-5 select-none">
          <span className="font-bold text-2xl tracking-tight text-[#1D1D1F] dark:text-zinc-100">
            SikkaDesk
          </span>
          <p className="text-xs font-semibold text-[#86868B] dark:text-zinc-400 mt-0.5">
            {storeName ? `${storeName} · Staff Terminal` : 'Store POS · Staff Terminal'}
          </p>
        </div>

        {/* Passcode Instruction */}
        <div className="w-full text-center mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-100 flex items-center justify-center mx-auto mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-base font-bold text-[#1D1D1F] dark:text-zinc-100">Enter 6-Digit PIN</p>
          <p className="text-xs text-[#86868B] dark:text-zinc-400 mt-0.5">
            Auto-detects your staff profile and permissions
          </p>
        </div>

        {/* 6-Digit PIN Indicators */}
        <div className={`flex items-center justify-center gap-3 my-2 ${shake ? 'animate-shake' : ''}`}>
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

        {/* Error message */}
        <div className="h-6 mt-1 flex items-center justify-center">
          {error && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 animate-in fade-in">
              {error}
            </p>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px] mt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigitClick(num)}
              disabled={isSubmitting}
              className="h-14 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800 hover:bg-[#E8E8ED] dark:hover:bg-zinc-700 active:scale-95 text-xl font-bold text-[#1D1D1F] dark:text-zinc-100 transition-all flex items-center justify-center shadow-xs border border-[#E5E5E7] dark:border-zinc-700 focus:outline-none cursor-pointer"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            disabled={isSubmitting || pin.length === 0}
            className="h-14 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800 hover:bg-[#E8E8ED] dark:hover:bg-zinc-700 active:scale-95 text-xs font-bold uppercase text-[#86868B] dark:text-zinc-400 transition-all flex items-center justify-center shadow-xs border border-[#E5E5E7] dark:border-zinc-700 focus:outline-none disabled:opacity-40 cursor-pointer"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            disabled={isSubmitting}
            className="h-14 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800 hover:bg-[#E8E8ED] dark:hover:bg-zinc-700 active:scale-95 text-xl font-bold text-[#1D1D1F] dark:text-zinc-100 transition-all flex items-center justify-center shadow-xs border border-[#E5E5E7] dark:border-zinc-700 focus:outline-none cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            disabled={isSubmitting || pin.length === 0}
            className="h-14 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800 hover:bg-[#E8E8ED] dark:hover:bg-zinc-700 active:scale-95 text-[#86868B] dark:text-zinc-400 transition-all flex items-center justify-center shadow-xs border border-[#E5E5E7] dark:border-zinc-700 focus:outline-none disabled:opacity-40 cursor-pointer"
            title="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Secure Access Footer Note */}
        <div className="mt-5 pt-3 border-t border-[#E5E5E7] dark:border-zinc-800 w-full text-center">
          <p className="text-[11px] text-[#86868B] dark:text-zinc-400 flex items-center justify-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1D1D1F] dark:text-zinc-200" />
            <span>Encrypted POS Session</span>
          </p>
        </div>

      </div>
    </div>
  );
};
