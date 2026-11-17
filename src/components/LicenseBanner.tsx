import React from 'react';
import { KeyRound, Clock, ChevronRight } from 'lucide-react';
import { type LicenseState } from '../types';

interface LicenseBannerProps {
  license: LicenseState;
  onOpenLicenseModal: () => void;
}

export const LicenseBanner: React.FC<LicenseBannerProps> = ({ license, onOpenLicenseModal }) => {
  if (!license.warningMessage && license.daysRemaining > 7 && !license.isTrial) {
    return null;
  }
  if (!license.isValid) {
    return null;
  }

  const isUrgent = license.daysRemaining <= 3;

  return (
    <div
      className={`px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 border-b select-none ${
        isUrgent
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0 opacity-75" />
        <span>
          {license.isTrial ? (
            <>
              <strong className="font-semibold">14-Day Pilot:</strong>{' '}
              <span className="tabular-nums">{license.daysRemaining}</span> day{license.daysRemaining !== 1 ? 's' : ''} remaining.
            </>
          ) : (
            <>
              <strong className="font-semibold">{license.tier.toUpperCase()} License:</strong> Expires in{' '}
              <span className="tabular-nums">{license.daysRemaining}</span> day{license.daysRemaining !== 1 ? 's' : ''}.
            </>
          )}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenLicenseModal}
        className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
          isUrgent
            ? 'bg-rose-700 hover:bg-rose-800 text-white'
            : 'bg-zinc-950 dark:bg-zinc-100 hover:opacity-90 text-white dark:text-zinc-950'
        }`}
      >
        <KeyRound className="w-3 h-3" />
        <span>{license.isTrial ? 'Activate Key' : 'Renew'}</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};
