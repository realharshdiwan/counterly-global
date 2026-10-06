import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/db';
import { type UserProfile, type UserRole } from '../types';
import { playBeep } from '../lib/printer';

export type AppTab = 'billing' | 'prices' | 'inventory' | 'schools' | 'bills' | 'settings';

interface AuthContextType {
  currentUser: UserProfile | null;
  users: UserProfile[];
  isLocked: boolean;
  loginWithPin: (pin: string) => Promise<{ success: boolean; user?: UserProfile; message?: string }>;
  switchUserWithPin: (pin: string) => Promise<{ success: boolean; user?: UserProfile; message?: string }>;
  lockScreen: () => void;
  unlockScreen: (pin: string) => Promise<boolean>;
  checkManagerOverride: (pin: string) => Promise<boolean>;
  canAccessTab: (tab: AppTab) => boolean;
  canEditPrices: () => boolean;
  canAdjustStock: () => boolean;
  canVoidBills: () => boolean;
  canManageSettings: () => boolean;
  canGiveDiscount: (type: 'flat' | 'percent', value: number, total: number) => boolean;
  refreshUsers: () => Promise<void>;
  updateUserPin: (userId: string, newPin: string) => Promise<boolean>;
  saveUserProfile: (user: Partial<UserProfile> & { id?: string }) => Promise<boolean>;
  deleteUserProfile: (userId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_USER_STORAGE_KEY = 'nandalaya_active_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLocked, setIsLocked] = useState<boolean>(false); // Unlocked on boot for seamless usage
  const [isInitializing, setIsInitializing] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);

  const loadUsers = async () => {
    try {
      const allUsers = await db.users.toArray();
      setUsers(allUsers);

      const savedUserId = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
      if (savedUserId) {
        const found = allUsers.find(u => u.id === savedUserId && u.active);
        if (found) {
          setCurrentUser(found);
          return;
        }
      }

      // Default to admin on first load
      const adminUser = allUsers.find(u => u.role === 'admin' && u.active) || allUsers[0];
      if (adminUser) {
        setCurrentUser(adminUser);
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, adminUser.id);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loginWithPin = async (pin: string): Promise<{ success: boolean; user?: UserProfile; message?: string }> => {
    // Check if terminal is temporarily locked due to multiple failed attempts
    const now = Date.now();
    if (now < lockoutUntil) {
      const secondsLeft = Math.ceil((lockoutUntil - now) / 1000);
      playBeep('warn');
      return {
        success: false,
        message: `Terminal locked for security. Try again in ${secondsLeft}s`,
      };
    }

    const cleanPin = pin.trim();
    if (cleanPin.length !== 6) {
      return { success: false, message: 'PIN must be exactly 6 digits' };
    }

    const allUsers = await db.users.toArray();
    const matchedUser = allUsers.find(u => u.pin === cleanPin && u.active);

    if (matchedUser) {
      setFailedAttempts(0);
      setLockoutUntil(0);
      setCurrentUser(matchedUser);
      setIsLocked(false);
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, matchedUser.id);
      playBeep('success');
      return { success: true, user: matchedUser };
    }

    const newFailedCount = failedAttempts + 1;
    playBeep('warn');

    if (newFailedCount >= 5) {
      const lockDuration = 30 * 1000; // 30 seconds lockout
      setLockoutUntil(now + lockDuration);
      setFailedAttempts(0);
      return {
        success: false,
        message: 'Too many incorrect attempts. Terminal locked for 30s.',
      };
    }

    setFailedAttempts(newFailedCount);
    const attemptsRemaining = 5 - newFailedCount;
    return {
      success: false,
      message: `Invalid 6-Digit PIN (${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining)`,
    };
  };

  const switchUserWithPin = async (pin: string) => {
    return loginWithPin(pin);
  };

  const lockScreen = () => {
    setIsLocked(true);
  };

  const unlockScreen = async (pin: string): Promise<boolean> => {
    const res = await loginWithPin(pin);
    return res.success;
  };

  const checkManagerOverride = async (pin: string): Promise<boolean> => {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6) return false;

    const allUsers = await db.users.toArray();
    const managerUser = allUsers.find(
      u => u.pin === cleanPin && u.active && (u.role === 'admin' || u.role === 'manager')
    );

    if (managerUser) {
      playBeep('success');
      return true;
    }
    playBeep('warn');
    return false;
  };

  const canAccessTab = (tab: AppTab): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;

    if (currentUser.role === 'manager') {
      return ['billing', 'prices', 'inventory', 'schools', 'bills', 'settings'].includes(tab);
    }

    // Cashier role: Allowed Billing and Bills history
    if (currentUser.role === 'cashier') {
      return ['billing', 'bills'].includes(tab);
    }

    return false;
  };

  const canEditPrices = (): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'manager';
  };

  const canAdjustStock = (): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'manager';
  };

  const canVoidBills = (): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'manager';
  };

  const canManageSettings = (): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'admin';
  };

  const canGiveDiscount = (type: 'flat' | 'percent', value: number, total: number): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'manager') return true;

    // Cashier discount limit checks
    if (type === 'percent') {
      const maxPct = currentUser.max_discount_percent ?? 5;
      return value <= maxPct;
    } else {
      const maxAmt = currentUser.max_discount_amount ?? 100;
      return value <= maxAmt;
    }
  };

  const updateUserPin = async (userId: string, newPin: string): Promise<boolean> => {
    if (newPin.trim().length !== 6) return false;
    try {
      await db.users.update(userId, { pin: newPin.trim() });
      await loadUsers();
      return true;
    } catch (err) {
      console.error('Failed to update PIN:', err);
      return false;
    }
  };

  const saveUserProfile = async (user: Partial<UserProfile> & { id?: string }): Promise<boolean> => {
    try {
      if (user.id) {
        await db.users.update(user.id, user);
      } else {
        const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newUser: UserProfile = {
          id: newId,
          name: user.name || 'New Staff',
          role: user.role || 'cashier',
          pin: user.pin || '123456',
          phone: user.phone || '',
          active: user.active ?? true,
          max_discount_percent: user.max_discount_percent ?? 5,
          max_discount_amount: user.max_discount_amount ?? 100,
          created_at: new Date().toISOString(),
        };
        await db.users.add(newUser);
      }
      await loadUsers();
      return true;
    } catch (err) {
      console.error('Failed to save user:', err);
      return false;
    }
  };

  const deleteUserProfile = async (userId: string): Promise<boolean> => {
    try {
      // Prevent deleting last admin
      const allUsers = await db.users.toArray();
      const adminCount = allUsers.filter(u => u.role === 'admin' && u.id !== userId).length;
      if (adminCount === 0) return false;

      await db.users.delete(userId);
      await loadUsers();
      return true;
    } catch (err) {
      console.error('Failed to delete user:', err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isLocked,
        loginWithPin,
        switchUserWithPin,
        lockScreen,
        unlockScreen,
        checkManagerOverride,
        canAccessTab,
        canEditPrices,
        canAdjustStock,
        canVoidBills,
        canManageSettings,
        canGiveDiscount,
        refreshUsers: loadUsers,
        updateUserPin,
        saveUserProfile,
        deleteUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
