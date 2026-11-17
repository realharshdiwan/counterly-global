import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { db, DEFAULT_CATEGORIES } from '../db/db';
import { type Category } from '../types';
import { useAuth } from '../context/AuthContext';
import { playBeep } from '../lib/printer';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesChanged,
}) => {
  const { currentUser } = useAuth();
  const isAdminOrLead = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('tops');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadData = async () => {
    try {
      let cats = await db.categories.toArray();
      if (cats.length === 0) {
        await db.categories.bulkAdd(DEFAULT_CATEGORIES);
        cats = await db.categories.toArray();
      }
      cats.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setCategories(cats);

      const products = await db.products.toArray();
      const counts: Record<string, number> = {};
      products.forEach(p => {
        const c = p.category?.toLowerCase() || 'uncategorized';
        counts[c] = (counts[c] || 0) + 1;
      });
      setProductCounts(counts);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setNewCatName('');
      setEditingId(null);
      setErrorMsg(null);
      setCategoryToDelete(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) return;

    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!slug) {
      setErrorMsg('Please enter a valid category name.');
      return;
    }

    if (categories.some(c => c.id === slug || c.name.toLowerCase() === clean.toLowerCase())) {
      setErrorMsg(`Category "${clean}" already exists.`);
      playBeep('warn');
      return;
    }

    try {
      await db.categories.add({
        id: slug,
        name: clean,
        sort_order: categories.length + 1,
      });
      playBeep('success');
      showToast(`Category "${clean}" added`);
      setNewCatName('');
      setErrorMsg(null);
      await loadData();
      onCategoriesChanged?.();
    } catch {
      setErrorMsg('Failed to create category.');
    }
  };

  const saveEditing = async (catId: string) => {
    const clean = editingName.trim();
    if (!clean) {
      setEditingId(null);
      return;
    }
    try {
      await db.categories.update(catId, { name: clean });
      playBeep('success');
      showToast('Category renamed');
      setEditingId(null);
      await loadData();
      onCategoriesChanged?.();
    } catch {
      setErrorMsg('Failed to rename category.');
    }
  };

  const executeDelete = async (catId: string, reassignTo?: string) => {
    try {
      if (reassignTo) {
        const productsToReassign = await db.products.where('category').equals(catId).toArray();
        for (const prod of productsToReassign) {
          await db.products.update(prod.id, { category: reassignTo });
        }
      }
      await db.categories.delete(catId);
      playBeep('success');
      showToast('Category removed');
      setCategoryToDelete(null);
      await loadData();
      onCategoriesChanged?.();
    } catch {
      setErrorMsg('Failed to delete category.');
    }
  };

  const handleInitiateDelete = (cat: Category) => {
    const count = productCounts[cat.id] || 0;
    if (count > 0) {
      const otherCats = categories.filter(c => c.id !== cat.id);
      setReassignTargetId(otherCats[0]?.id || 'tops');
      setCategoryToDelete(cat);
    } else {
      executeDelete(cat.id);
    }
  };

  const handleResetDefaults = async () => {
    await db.categories.clear();
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    playBeep('success');
    showToast('Categories reset to retail defaults');
    await loadData();
    onCategoriesChanged?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-zinc-950 dark:text-zinc-50">Product Categories</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Organize products for quick filtering at the register
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {toastMessage && (
          <div className="mt-3 p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs font-medium text-center">
            {toastMessage}
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {isAdminOrLead ? (
            <form onSubmit={handleAddCategory} className="flex items-center gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="New category (e.g. Outerwear, Handbags)"
                className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <button
                type="submit"
                disabled={!newCatName.trim()}
                className="h-9 px-3.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          ) : (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Shift Lead or Admin PIN required to edit categories.</span>
            </div>
          )}

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {categories.map(cat => {
              const count = productCounts[cat.id] || 0;
              const isEditing = editingId === cat.id;

              return (
                <div key={cat.id} className="px-3.5 py-2.5 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        className="h-8 px-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-xs bg-white dark:bg-zinc-950 flex-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEditing(cat.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEditing(cat.id)}
                        className="p-1.5 rounded-md bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {cat.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {count} product{count === 1 ? '' : 's'}
                        </div>
                      </div>

                      {isAdminOrLead && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(cat.id);
                              setEditingName(cat.name);
                            }}
                            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInitiateDelete(cat)}
                            className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {categoryToDelete && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Reassign <strong>{productCounts[categoryToDelete.id]}</strong> product(s) from{' '}
                <strong>{categoryToDelete.name}</strong> before deleting:
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={reassignTargetId}
                  onChange={e => setReassignTargetId(e.target.value)}
                  className="flex-1 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs bg-white dark:bg-zinc-950"
                >
                  {categories
                    .filter(c => c.id !== categoryToDelete.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        Move to: {c.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => executeDelete(categoryToDelete.id, reassignTargetId)}
                  className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Move &amp; Delete
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          {isAdminOrLead ? (
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
