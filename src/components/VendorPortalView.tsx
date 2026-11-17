import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Lock,
  Plus,
  Copy,
  Check,
  Search,
  LogOut,
  ArrowLeft,
  ShieldAlert,
  RotateCcw,
  Printer,
} from 'lucide-react';
import { type VendorLicenseRecord, type LicenseTier } from '../types';

interface VendorPortalViewProps {
  onBackToLanding: () => void;
  onLaunchPOS: () => void;
}

const VENDOR_TOKEN_KEY = 'counterly_vendor_session_token';

export const VendorPortalView: React.FC<VendorPortalViewProps> = ({
  onBackToLanding,
  onLaunchPOS,
}) => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(VENDOR_TOKEN_KEY) || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [licenses, setLicenses] = useState<VendorLicenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');

  // Mint Key Form State
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [tier, setTier] = useState<LicenseTier>('pro');
  const [duration, setDuration] = useState<'1y' | '2y' | 'lifetime'>('1y');
  const [machineId, setMachineId] = useState('');
  const [notes, setNotes] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [newlyIssued, setNewlyIssued] = useState<VendorLicenseRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchLicenses = async (activeToken: string) => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/vendor/licenses', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (resp.status === 401) {
        sessionStorage.removeItem(VENDOR_TOKEN_KEY);
        setToken('');
        return;
      }
      const data = await resp.json();
      if (data.success && Array.isArray(data.licenses)) {
        setLicenses(data.licenses);
      }
    } catch {
      setIssueError('Unable to reach SikkaDesk licensing server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLicenses(token);
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const resp = await fetch('/api/vendor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.token) {
        sessionStorage.setItem(VENDOR_TOKEN_KEY, data.token);
        setToken(data.token);
        setPasswordInput('');
      } else {
        setAuthError(data.message || 'Authentication failed.');
      }
    } catch {
      setAuthError('Server unavailable. Verify the Node server is running.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(VENDOR_TOKEN_KEY);
    setToken('');
    setLicenses([]);
    setNewlyIssued(null);
  };

  const handleIssueKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) {
      setIssueError('Store / Buyer name is required.');
      return;
    }
    setIsIssuing(true);
    setIssueError(null);
    try {
      const resp = await fetch('/api/vendor/licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          tier,
          duration: tier === 'lifetime' ? 'lifetime' : duration,
          machineId: machineId.trim(),
          notes: notes.trim(),
        }),
      });
      if (resp.status === 401) {
        handleLogout();
        return;
      }
      const data = await resp.json();
      if (resp.ok && data.success && data.license) {
        setNewlyIssued(data.license);
        setLicenses(prev => [data.license, ...prev.filter(l => l.key !== data.license.key)]);
        setBuyerName('');
        setBuyerEmail('');
        setMachineId('');
        setNotes('');
      } else {
        setIssueError(data.message || 'Failed to mint license key.');
      }
    } catch {
      setIssueError('Network error while minting license key.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleToggleRevoke = async (record: VendorLicenseRecord) => {
    try {
      const resp = await fetch('/api/vendor/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: record.key,
          revoked: !record.revoked,
        }),
      });
      if (resp.status === 401) {
        handleLogout();
        return;
      }
      const data = await resp.json();
      if (resp.ok && data.success && data.license) {
        setLicenses(prev => prev.map(l => (l.key === record.key ? data.license : l)));
      }
    } catch {
      // ignore
    }
  };

  const copyKey = (keyStr: string) => {
    navigator.clipboard?.writeText(keyStr).catch(() => {});
    setCopiedKey(keyStr);
    setTimeout(() => setCopiedKey(prev => (prev === keyStr ? null : prev)), 2000);
  };

  const summary = useMemo(() => {
    const now = Date.now();
    const active = licenses.filter(
      l => !l.revoked && new Date(l.expiresAt).getTime() > now
    ).length;
    const expiringSoon = licenses.filter(l => {
      if (l.revoked || l.tier === 'lifetime') return false;
      const diffDays = (new Date(l.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30;
    }).length;
    const revoked = licenses.filter(l => l.revoked).length;
    return { total: licenses.length, active, expiringSoon, revoked };
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return licenses.filter(l => {
      if (statusFilter === 'active' && l.revoked) return false;
      if (statusFilter === 'revoked' && !l.revoked) return false;
      if (!q) return true;
      return (
        l.key.toLowerCase().includes(q) ||
        l.buyerName.toLowerCase().includes(q) ||
        (l.buyerEmail && l.buyerEmail.toLowerCase().includes(q)) ||
        l.machineId.toLowerCase().includes(q)
      );
    });
  }, [licenses, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBackToLanding}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <span className="font-bold text-base tracking-tight whitespace-nowrap">
              SikkaDesk Licensing
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onLaunchPOS}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              Open POS
            </button>
            {token && (
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {!token ? (
          <div className="max-w-md mx-auto mt-10 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-7 space-y-5 shadow-xs">
            <div className="space-y-1.5 text-center">
              <div className="w-11 h-11 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Vendor License Portal</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sign in with your server vendor passphrase to mint or revoke SikkaDesk annual license keys.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-400">
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                  Server Vendor Passphrase
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="Enter vendor passphrase"
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm"
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Configured via <span className="font-mono">COUNTERLY_VENDOR_PASSWORD</span> on the server.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-10 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? 'Verifying...' : 'Unlock Vendor Console'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Total Keys Issued</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{summary.total}</div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Active Licenses</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {summary.active}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Expiring (&le;30d)</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {summary.expiringSoon}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Revoked Keys</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                  {summary.revoked}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Mint Form */}
              <div className="lg:col-span-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <KeyRound className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-sm font-bold">Issue New License Key</h2>
                </div>

                {issueError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-400">
                    {issueError}
                  </div>
                )}

                <form onSubmit={handleIssueKey} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Buyer Store Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={buyerName}
                      onChange={e => setBuyerName(e.target.value)}
                      placeholder="e.g. Vastra Apparel Studio"
                      className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Buyer Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={e => setBuyerEmail(e.target.value)}
                      placeholder="owner@vastrastudio.in"
                      className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                        Plan Tier
                      </label>
                      <select
                        value={tier}
                        onChange={e => setTier(e.target.value as LicenseTier)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium"
                      >
                        <option value="starter">Starter (₹1,499/yr)</option>
                        <option value="pro">Pro (₹2,999/yr)</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                        Term
                      </label>
                      <select
                        value={tier === 'lifetime' ? 'lifetime' : duration}
                        disabled={tier === 'lifetime'}
                        onChange={e => setDuration(e.target.value as '1y' | '2y' | 'lifetime')}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium disabled:opacity-50"
                      >
                        <option value="1y">1 Year</option>
                        <option value="2y">2 Years</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Terminal ID Lock (Optional)
                    </label>
                    <input
                      type="text"
                      value={machineId}
                      onChange={e => setMachineId(e.target.value.toUpperCase())}
                      placeholder="Leave blank for UNIV (any terminal)"
                      className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Hardware / Order Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. ₹18,999 Kit #HW-108"
                      className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isIssuing}
                    className="w-full h-10 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isIssuing ? 'Minting Key...' : 'Generate & Record Key'}</span>
                  </button>
                </form>

                {newlyIssued && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Issued for {newlyIssued.buyerName}
                      </span>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Slip</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs font-bold break-all select-all">
                      {newlyIssued.key}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyKey(newlyIssued.key)}
                      className="w-full py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {copiedKey === newlyIssued.key ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied Key</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Activation Key</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Ledger Table */}
              <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700 w-fit text-xs">
                    {(['all', 'active', 'revoked'] as const).map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1 rounded-lg font-semibold capitalize cursor-pointer ${
                          statusFilter === st
                            ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950'
                            : 'text-zinc-500'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search store, email, or key..."
                      className="w-full h-9 pl-8 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                    />
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-8 text-center text-xs text-zinc-500">Loading server ledger...</div>
                ) : filteredLicenses.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <KeyRound className="w-7 h-7 text-zinc-400 mx-auto" />
                    <p className="text-xs font-medium text-zinc-500">
                      {licenses.length === 0
                        ? 'No keys issued yet. Generate your first customer key on the left.'
                        : 'No license keys match your filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                          <th className="py-2.5 px-4 font-medium">Buyer &amp; Key</th>
                          <th className="py-2.5 px-3 font-medium">Tier</th>
                          <th className="py-2.5 px-3 font-medium">Expires</th>
                          <th className="py-2.5 px-3 font-medium">Status</th>
                          <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredLicenses.map(rec => {
                          const isExpired =
                            rec.tier !== 'lifetime' && new Date(rec.expiresAt).getTime() < Date.now();
                          return (
                            <tr
                              key={rec.key}
                              className="hover:bg-zinc-50/80 dark:hover:bg-zinc-950/60"
                            >
                              <td className="py-3 px-4">
                                <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                                  {rec.buyerName}
                                </div>
                                <div className="font-mono text-[11px] text-zinc-500 mt-0.5">
                                  {rec.key}
                                </div>
                                {(rec.buyerEmail || rec.notes) && (
                                  <div className="text-[11px] text-zinc-400 mt-0.5">
                                    {[rec.buyerEmail, rec.notes].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 uppercase font-mono text-[11px] font-semibold">
                                {rec.tier} · {rec.machineId}
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                                {rec.tier === 'lifetime'
                                  ? 'Never'
                                  : new Date(rec.expiresAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-3 font-semibold">
                                {rec.revoked ? (
                                  <span className="text-rose-600 dark:text-rose-400">Revoked</span>
                                ) : isExpired ? (
                                  <span className="text-amber-600 dark:text-amber-400">Expired</span>
                                ) : (
                                  <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => copyKey(rec.key)}
                                    className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                  >
                                    {copiedKey === rec.key ? 'Copied' : 'Copy'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRevoke(rec)}
                                    className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                                      rec.revoked
                                        ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                        : 'border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {rec.revoked ? (
                                      <>
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Reinstate</span>
                                      </>
                                    ) : (
                                      <>
                                        <ShieldAlert className="w-3 h-3" />
                                        <span>Revoke</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
