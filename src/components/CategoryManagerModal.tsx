import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  AlertCircle, 
  Package, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { db, DEFAULT_CATEGORIES } from '../db/db';
import { type Category, type Product } from '../types';
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
  
  // Deletion modal state for reassigning products
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('uniform');

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

      // Tally products per category
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

  // Handle Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) return;

    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!slug) {
      setErrorMsg('Please enter a valid category name');
      return;
    }

    // Check duplicate
    if (categories.some(c => c.id === slug || c.name.toLowerCase() === clean.toLowerCase())) {
      setErrorMsg(`A category named "${clean}" already exists`);
      playBeep('warn');
      return;
    }

    try {
      const newCat: Category = {
        id: slug,
        name: clean,
        sort_order: categories.length + 1,
      };
      await db.categories.add(newCat);
      playBeep('success');
      showToast(`Category "${clean}" created`);
      setNewCatName('');
      setErrorMsg(null);
      await loadData();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      console.error('Failed to add category:', err);
      setErrorMsg('Failed to create category');
    }
  };

  // Start Editing
  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
    setErrorMsg(null);
  };

  // Save Edit
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
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      console.error('Failed to update category:', err);
      setErrorMsg('Failed to rename category');
    }
  };

  // Initiate Delete
  const handleInitiateDelete = (cat: Category) => {
    const count = productCounts[cat.id] || 0;
    if (count > 0) {
      // Must prompt to reassign products
      const otherCats = categories.filter(c => c.id !== cat.id);
      setReassignTargetId(otherCats[0]?.id || 'uniform');
      setCategoryToDelete(cat);
    } else {
      // Safe to delete directly
      executeDelete(cat.id);
    }
  };

  // Execute Delete
  const executeDelete = async (catId: string, reassignTo?: string) => {
    try {
      if (reassignTo) {
        // Update all products in this category
        const productsToReassign = await db.products.where('category').equals(catId).toArray();
        for (const prod of productsToReassign) {
          await db.products.update(prod.id, { category: reassignTo });
        }
      }

      await db.categories.delete(catId);
      playBeep('success');
      showToast('Category deleted');
      setCategoryToDelete(null);
      await loadData();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      console.error('Failed to delete category:', err);
      setErrorMsg('Failed to delete category');
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async () => {
    try {
      await db.categories.clear();
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
      playBeep('success');
      showToast('Categories reset to defaults');
      await loadData();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      console.error('Failed to reset categories:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-xl border border-[#E5E5E7] animate-in fade-in-50 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#1D1D1F]">Manage Product Categories</h2>
              <p className="text-xs text-[#86868B]">
                Add, rename, or remove product classification categories
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#86868B] hover:text-[#1D1D1F] p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="mt-3 p-2.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7] rounded-xl text-xs font-semibold text-center">
            {toastMessage}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mt-3 p-2.5 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">

          {/* Add Category Form (Lead / Admin Only) */}
          {isAdminOrLead ? (
            <form onSubmit={handleAddCategory} className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] space-y-2">
              <label className="text-xs font-semibold text-[#1D1D1F] block">
                Add New Category
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="e.g. Stationery, Sports Kit, Rainwear..."
                  className="flex-1 h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-medium bg-white focus:outline-none focus:border-[#1D1D1F]"
                />
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="h-9 px-4 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] text-[#515154] text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1D1D1F] shrink-0" />
              <span>Shift Lead or Store Admin PIN required to create or modify categories.</span>
            </div>
          )}

          {/* Category List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#86868B] uppercase px-1 tracking-wider">
              <span>Category Name</span>
              <span>Items Linked / Actions</span>
            </div>

            {categories.map(cat => {
              const count = productCounts[cat.id] || 0;
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl bg-white border border-[#E5E5E7] hover:border-[#D2D2D7] transition-all flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center font-bold text-xs shrink-0">
                      <Package className="w-4 h-4" />
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          className="h-8 px-2.5 rounded-lg border border-[#1D1D1F] text-xs font-medium bg-white flex-1 focus:outline-none"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEditing(cat.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => saveEditing(cat.id)}
                          className="p-1.5 rounded-lg bg-[#1D1D1F] text-white hover:bg-[#333336]"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg bg-[#F5F5F7] text-[#515154] hover:bg-[#E8E8ED]"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[#1D1D1F] capitalize truncate">
                          {cat.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#86868B]">
                          id: {cat.id}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium text-[#515154] bg-[#F5F5F7] px-2 py-0.5 rounded-md border border-[#E5E5E7]">
                        {count} item{count === 1 ? '' : 's'}
                      </span>

                      {isAdminOrLead && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditing(cat)}
                            className="p-1.5 rounded-lg hover:bg-[#F5F5F7] text-[#1D1D1F] transition-colors cursor-pointer"
                            title="Rename Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInitiateDelete(cat)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Delete with Reassignment Warning Dialog */}
          {categoryToDelete && (
            <div className="p-4 rounded-xl bg-[#F5F5F7] border border-amber-200 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-[#1D1D1F]">
                    Reassign Products in "{categoryToDelete.name}"
                  </h4>
                  <p className="text-[11px] text-[#515154] mt-0.5">
                    There are <strong>{productCounts[categoryToDelete.id] || 0} product(s)</strong> currently assigned to this category. Select which category to move them to before deleting:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={reassignTargetId}
                  onChange={e => setReassignTargetId(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl border border-[#E5E5E7] text-xs font-medium bg-white focus:outline-none"
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
                  className="h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reassign &amp; Delete
                </button>

                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="h-9 px-2.5 rounded-xl bg-white border border-[#E5E5E7] text-[#1D1D1F] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E5E5E7] flex items-center justify-between text-[11px]">
          {isAdminOrLead ? (
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-[#86868B] hover:text-[#1D1D1F] flex items-center gap-1 font-medium cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Defaults</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
