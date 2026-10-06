import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 text-white px-3 py-1.5 text-xs font-bold shadow-lg border border-amber-500 animate-in slide-in-from-bottom-2">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Operating from Local Database</span>
    </div>
  );
};
