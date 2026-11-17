import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  X,
  RotateCcw,
} from 'lucide-react';
import { db } from '../db/db';
import { type AppTab } from '../context/AuthContext';

interface GuidedSandboxBannerProps {
  onNavigateTab: (tab: AppTab) => void;
  onSwitchToLiveStore: () => Promise<void> | void;
  refreshSignal?: number;
}

export const GuidedSandboxBanner: React.FC<GuidedSandboxBannerProps> = ({
  onNavigateTab,
  onSwitchToLiveStore,
  refreshSignal = 0,
}) => {
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('counterly_sandbox_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('counterly_sandbox_checklist_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [confirmLiveReset, setConfirmLiveReset] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const [progress, setProgress] = useState({
    hasNewSale: false,
    hasReturnOrSwap: false,
    hasCostMargins: false,
    hasShiftClose: false,
  });

  const refreshChecklist = useCallback(async () => {
    try {
      const active = localStorage.getItem('counterly_sandbox_mode') === 'true';
      setIsSandboxMode(active);
      if (!active) return;

      const [bills, variants, shiftCloseCount] = await Promise.all([
        db.bills.toArray(),
        db.variants.toArray(),
        db.shift_closes.count(),
      ]);

      const billsCount = bills.length;
      const returnsCount = bills.reduce(
        (acc, b) => acc + (b.return_records ? b.return_records.length : 0),
        0
      );
      const hasExchange = bills.some(b => b.status === 'exchanged');
      const variantsWithCostCount = variants.filter(
        v => typeof v.cost_price === 'number' && v.cost_price > 0
      ).length;

      setProgress({
        hasNewSale: billsCount > 4,
        hasReturnOrSwap: returnsCount > 0 || hasExchange,
        hasCostMargins: variantsWithCostCount > 0,
        hasShiftClose: shiftCloseCount > 0,
      });
    } catch {
      // ignore read error
    }
  }, []);

  useEffect(() => {
    refreshChecklist();
    const timer = window.setInterval(refreshChecklist, 4000);
    return () => window.clearInterval(timer);
  }, [refreshChecklist, refreshSignal]);

  if (!isSandboxMode || isDismissed) return null;

  const steps = [
    {
      id: 'sale',
      done: progress.hasNewSale,
      label: 'Ring up a sale & test tax/discounts',
      tab: 'billing' as AppTab,
    },
    {
      id: 'return',
      done: progress.hasReturnOrSwap,
      label: 'Process a partial return or swap',
      tab: 'bills' as AppTab,
    },
    {
      id: 'margins',
      done: progress.hasCostMargins,
      label: 'Inspect profit margins & store credit',
      tab: 'catalog' as AppTab,
    },
    {
      id: 'zreport',
      done: progress.hasShiftClose,
      label: 'Save a shift Z-Report & export backup',
      tab: 'bills' as AppTab,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  const handleConfirmLiveSwitch = async () => {
    setIsSwitching(true);
    try {
      await onSwitchToLiveStore();
      setIsSandboxMode(false);
      setConfirmLiveReset(false);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('counterly_sandbox_checklist_dismissed', 'true');
    } catch {
      // ignore
    }
    setIsDismissed(true);
  };

  return (
    <div className="bg-zinc-900 dark:bg-zinc-900 text-white border-b border-zinc-800 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Guided Sandbox</span>
            <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
              · {completedCount}/4 done
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {steps.map(step => (
              <button
                key={step.id}
                type="button"
                onClick={() => onNavigateTab(step.tab)}
                className={`flex items-center gap-1.5 text-[11px] cursor-pointer transition-opacity hover:opacity-100 ${
                  step.done ? 'text-emerald-400' : 'text-zinc-300 opacity-85'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                )}
                <span className={step.done ? 'line-through opacity-80' : ''}>{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
          {!confirmLiveReset ? (
            <button
              type="button"
              onClick={() => setConfirmLiveReset(true)}
              className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer hover:opacity-90 whitespace-nowrap"
            >
              <span>Switch to Live Store</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
              <span className="text-[11px] text-zinc-200">Clear demo data?</span>
              <button
                type="button"
                disabled={isSwitching}
                onClick={handleConfirmLiveSwitch}
                className="px-2 py-0.5 rounded bg-emerald-500 text-zinc-950 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isSwitching ? 'Resetting...' : 'Confirm'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmLiveReset(false)}
                className="px-2 py-0.5 rounded text-zinc-300 hover:text-white text-[11px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-zinc-400 hover:text-white cursor-pointer"
            title="Hide sandbox checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
