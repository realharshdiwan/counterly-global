import React from 'react';
import { KeyRound, Clock, ChevronRight } from 'lucide-react';
import { type LicenseState } from '../types';

interface LicenseBannerProps {
  license: LicenseState;
  onOpenLicenseModal: () => void;
}

export const LicenseBanner: React.FC<LicenseBannerProps> = ({ license, onOpenLicenseModal }) => {
  // If license is permanently valid or active with more than 5 days left, don't clutter the top
  if (!license.warningMessage && license.daysRemaining > 5 && !license.isTrial) {
    return null;
  }

  // If already expired, the full lockout screen will take over
  if (!license.isValid) {
    return null;
  }

  const isUrgent = license.daysRemaining <= 3;

  return (
    <div
      className={`px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 border-b transition-colors select-none ${
        isUrgent
          ? 'bg-rose-50 border-rose-200 text-rose-900'
          : license.isTrial
          ? 'bg-stone-100 border-stone-200 text-stone-900'
          : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span>
          {license.isTrial ? (
            <>
              <strong className="font-semibold">14-Day Free Pilot:</strong> {license.daysRemaining} day
              {license.daysRemaining !== 1 ? 's' : ''} remaining.
            </>
          ) : (
            <>
              <strong className="font-semibold">{license.tier.toUpperCase()} Edition:</strong> Expires in{' '}
              {license.daysRemaining} day{license.daysRemaining !== 1 ? 's' : ''}.
            </>
          )}
        </span>
        <span className="hidden md:inline text-[11px] opacity-70">
          — Activate full annual license for uninterrupted rush-hour counter billing.
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenLicenseModal}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold tracking-tight transition-colors cursor-pointer ${
          isUrgent
            ? 'bg-rose-700 hover:bg-rose-800 text-white'
            : 'bg-stone-900 hover:bg-stone-800 text-white'
        }`}
      >
        <KeyRound className="w-3 h-3" />
        <span>{license.isTrial ? 'Activate License' : 'Renew Subscription'}</span>
        <ChevronRight className="w-3 h-3 ml-0.5" />
      </button>
    </div>
  );
};
