import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { type UserProfile, type UserRole, type ShopConfig, ROLE_INFO } from '../types';
import { db } from '../db/db';
import { formatMoney, getCurrencySymbol } from '../lib/locale';

interface StaffManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StaffManagerModal: React.FC<StaffManagerModalProps> = ({ isOpen, onClose }) => {
  const { users, currentUser, saveUserProfile, deleteUserProfile, refreshUsers } = useAuth();
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);

  const [editingUser, setEditingUser] = useState<Partial<UserProfile> | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [maxDiscountPct, setMaxDiscountPct] = useState('5');
  const [maxDiscountAmt, setMaxDiscountAmt] = useState('50');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      db.shop_config.toArray().then((cfgs) => {
        if (cfgs.length > 0) setShopConfig(cfgs[0]);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('Image file size must be under 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
          setErrorMsg(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser({ id: '' });
    setName('');
    setRole('cashier');
    setPin('');
    setPhone('');
    setAvatarUrl('');
    setMaxDiscountPct('5');
    setMaxDiscountAmt('100');
    setIsActive(true);
    setErrorMsg(null);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setName(user.name);
    setRole(user.role);
    setPin(user.pin);
    setPhone(user.phone || '');
    setAvatarUrl(user.avatar_url || '');
    setMaxDiscountPct(String(user.max_discount_percent ?? 5));
    setMaxDiscountAmt(String(user.max_discount_amount ?? 100));
    setIsActive(user.active);
    setErrorMsg(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPin = pin.trim();

    if (!cleanName) {
      setErrorMsg('Please enter staff name');
      return;
    }

    if (!/^\d{6}$/.test(cleanPin)) {
      setErrorMsg('PIN must be exactly 6 numeric digits (e.g. 123456)');
      return;
    }

    const duplicate = users.find(u => u.pin === cleanPin && u.id !== editingUser?.id);
    if (duplicate) {
      setErrorMsg(`PIN is already assigned to ${duplicate.name}. Use a different 6-digit PIN.`);
      return;
    }

    try {
      const userPayload: Partial<UserProfile> & { id?: string } = {
        name: cleanName,
        role,
        pin: cleanPin,
        phone: phone.trim(),
        avatar_url: avatarUrl.trim(),
        active: isActive,
        max_discount_percent: parseFloat(maxDiscountPct) || 0,
        max_discount_amount: parseFloat(maxDiscountAmt) || 0,
      };

      if (editingUser?.id) {
        userPayload.id = editingUser.id;
      }

      const success = await saveUserProfile(userPayload);
      if (success) {
        showToast(editingUser?.id ? 'Staff profile updated!' : 'New staff member added!');
        setEditingUser(null);
        await refreshUsers();
      } else {
        setErrorMsg('Failed to save staff');
      }
    } catch {
      setErrorMsg('Error saving staff');
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (users.length <= 1) {
      showToast('Cannot delete the only remaining user');
      return;
    }

    const success = await deleteUserProfile(userId);
    if (success) {
      showToast(`${userName} removed`);
      await refreshUsers();
    } else {
      showToast('Cannot delete the last admin account');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl border border-[#E5E5E7] dark:border-zinc-800 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E5E7] dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-[#1D1D1F] dark:text-zinc-100 tracking-tight">
                Team Roles &amp; Shift PINs
              </h2>
              <p className="text-xs text-[#86868B] dark:text-zinc-400">
                Configure staff accounts, role permissions, and 6-digit counter PINs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-bold hover:bg-[#333336] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-xl hover:bg-[#F5F5F7] cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
            <Check className="w-3.5 h-3.5 text-[#1D1D1F]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto py-3.5 space-y-3 pr-1">
          
          {/* Active Edit Form */}
          {editingUser ? (
            <form onSubmit={handleSaveUser} className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#E5E5E7] pb-2">
                <span className="font-extrabold text-xs text-[#1D1D1F]">
                  {editingUser.id ? 'Edit Staff Member' : 'Add New Staff Member'}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-xs font-bold text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-white text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-[#1D1D1F] shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1D1D1F] block mb-1">
                    Staff Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1D1D1F] block mb-1">
                    Role &amp; Responsibilities *
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
                  >
                    <option value="cashier">Counter Associate · Billing &amp; Customer Checkout</option>
                    <option value="manager">Shift Lead · Catalog, Stock &amp; Team Approvals</option>
                    <option value="admin">Store Admin · Full Store Setup, Cloud Sync &amp; Backup</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1D1D1F] block mb-1">
                    6-Digit Counter PIN *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 Digits (e.g. 112233)"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-mono font-bold bg-white text-[#1D1D1F] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1D1D1F] block mb-1">
                    Mobile Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F] focus:outline-none"
                  />
                </div>

                {/* Profile Picture Upload Section */}
                <div className="sm:col-span-2 pt-2 border-t border-[#E5E5E7]">
                  <label className="text-xs font-bold text-[#1D1D1F] block mb-1.5">
                    Profile Picture / Avatar
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-[#E5E5E7]">
                    <div className="w-11 h-11 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-base overflow-hidden shrink-0 border border-[#E5E5E7]">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Staff Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{name.trim().charAt(0) || '?'}</span>
                      )}
                    </div>

                    <div className="flex-1 space-y-1 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <label className="px-3 py-1.5 rounded-lg bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                            className="hidden"
                          />
                        </label>
                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrl('')}
                            className="px-2.5 py-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#86868B] hover:text-[#1D1D1F] text-xs font-bold cursor-pointer border border-[#E5E5E7] transition-colors"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-[#86868B]">
                        Choose a photo (PNG, JPG, WEBP under 2MB). Shown in header profile switcher &amp; team roster.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {role === 'cashier' && (
                <div className="pt-2 border-t border-[#E5E5E7] grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#1D1D1F] block mb-0.5">
                      Counter Discount Allowance (%)
                    </label>
                    <input
                      type="number"
                      value={maxDiscountPct}
                      onChange={e => setMaxDiscountPct(e.target.value)}
                      className="w-full h-8 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                    />
                    <span className="text-[10px] text-[#86868B]">Above this requires Shift Lead PIN confirmation</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#1D1D1F] block mb-0.5">
                      Counter Discount Allowance ({getCurrencySymbol(shopConfig)})
                    </label>
                    <input
                      type="number"
                      value={maxDiscountAmt}
                      onChange={e => setMaxDiscountAmt(e.target.value)}
                      className="w-full h-8 px-3 rounded-xl border border-[#E5E5E7] text-xs font-bold bg-white text-[#1D1D1F]"
                    />
                    <span className="text-[10px] text-[#86868B]">Above this requires Shift Lead PIN confirmation</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-[#1D1D1F]"
                  />
                  <span>Account Active (Allowed on POS)</span>
                </label>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-xs font-bold hover:bg-[#333336] transition-colors shadow-xs cursor-pointer"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          ) : null}

          {/* Staff List Cards */}
          <div className="space-y-2">
            {users.map(u => {
              const isSelf = currentUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl bg-white border border-[#E5E5E7] hover:border-[#1D1D1F] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 border border-[#E5E5E7]">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name.charAt(0)
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1D1D1F]">{u.name}</span>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-md bg-[#F5F5F7] text-[#1D1D1F] text-[10px] font-bold border border-[#E5E5E7]">
                            You (Active)
                          </span>
                        )}
                        {!u.active && (
                          <span className="px-2 py-0.5 rounded-md bg-[#F5F5F7] text-[#86868B] text-[10px] font-bold border border-[#E5E5E7]">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#1D1D1F] mt-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F]" />
                          <span>{ROLE_INFO[u.role]?.label || u.role}</span>
                        </span>
                        <span className="text-[11px] text-[#86868B] font-medium hidden sm:inline">
                          ({ROLE_INFO[u.role]?.tagline})
                        </span>
                        <span className="text-[#86868B]">·</span>
                        <span className="font-mono text-[11px] text-[#86868B] font-bold">PIN: ••••••</span>
                        {u.role === 'cashier' && (
                          <>
                            <span className="text-[#86868B]">·</span>
                            <span className="text-[10px] text-[#1D1D1F] font-bold bg-[#F5F5F7] px-1.5 py-0.5 rounded-md border border-[#E5E5E7]">
                              Allowance: {u.max_discount_percent ?? 5}% / {formatMoney(u.max_discount_amount ?? 100, shopConfig)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="px-3 py-1.5 rounded-xl border border-[#E5E5E7] hover:bg-[#F5F5F7] text-xs font-bold text-[#1D1D1F] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit &amp; PIN</span>
                    </button>

                    {!isSelf && (
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="p-1.5 rounded-xl border border-[#E5E5E7] hover:bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                        title="Remove staff member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E5E5E7] text-[11px] text-[#86868B] flex items-center justify-between">
          <span>Counter Associates handle front billing. Shift Leads &amp; Store Admins oversee catalog pricing, inventory, and shift approvals.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-xs font-bold text-[#1D1D1F] cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
