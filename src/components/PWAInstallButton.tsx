import React, { useState } from 'react';
import { Download, Monitor, Share, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside an installed PWA window, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Edge / Android / Windows Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Install Counterly as an Offline Desktop App on your PC"
        className={`flex items-center gap-1.5 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white font-semibold text-xs transition-all shadow-xs active:scale-95 px-3 py-1.5 cursor-pointer ${className}`}
      >
        <Monitor className="w-3.5 h-3.5 text-slate-300" />
        <span>{compact ? 'Install' : 'Install Desktop App'}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl border border-[#E5E5E7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold text-xs transition-all px-3 py-1.5 shadow-xs cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{compact ? 'Install' : 'Install on iPad/iPhone'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-[#E5E5E7] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">Install Counterly App</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-[#86868B] hover:text-[#1D1D1F] p-1 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#515154]">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F5F5F7]">
                  <span className="font-bold text-[#1D1D1F] bg-white w-5 h-5 rounded-full flex items-center justify-center shadow-xs shrink-0">1</span>
                  <span>Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline mx-0.5 text-[#0071E3]" /> in Safari's bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F5F5F7]">
                  <span className="font-bold text-[#1D1D1F] bg-white w-5 h-5 rounded-full flex items-center justify-center shadow-xs shrink-0">2</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F5F5F7]">
                  <span className="font-bold text-[#1D1D1F] bg-white w-5 h-5 rounded-full flex items-center justify-center shadow-xs shrink-0">3</span>
                  <span>Counterly will launch in full-screen standalone mode with 100% offline access.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#333336] cursor-pointer transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
