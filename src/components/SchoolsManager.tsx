import React, { useState, useEffect, useMemo } from 'react';
import { 
  School as SchoolIcon, 
  Search, 
  Plus, 
  Edit3, 
  Tag, 
  Zap, 
  Phone, 
  MapPin, 
  Check, 
  X, 
  Building2,
  Sliders,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { db } from '../db/db';
import { type School, type PriceEntry, type StoreBusinessType } from '../types';
import { SchoolModal } from './SchoolModal';
import { CatalogGeneratorModal } from './CatalogGeneratorModal';
import { getCatalogTabMeta } from '../lib/catalogLabels';

interface SchoolsManagerProps {
  onSelectSchoolForBilling?: (school: School) => void;
  onViewSchoolPrices?: (schoolId: string) => void;
}

export const SchoolsManager: React.FC<SchoolsManagerProps> = ({
  onSelectSchoolForBilling,
  onViewSchoolPrices,
}) => {
  const [schools, setSchools] = useState<School[]>([]);
  const [priceCounts, setPriceCounts] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [storeType, setStoreType] = useState<StoreBusinessType | undefined>('apparel');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schoolToEdit, setSchoolToEdit] = useState<School | null>(null);
  const [isCatalogGenOpen, setIsCatalogGenOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadSchools = async () => {
    try {
      const [allSchools, allPrices, cfgs] = await Promise.all([
        db.schools.toArray(),
        db.price_list.toArray(),
        db.shop_config.toArray(),
      ]);

      setSchools(allSchools);
      if (cfgs.length > 0) setStoreType(cfgs[0].store_type);

      // Count rates mapped to each school
      const counts = new Map<string, number>();
      for (const p of allPrices) {
        counts.set(p.school_id, (counts.get(p.school_id) || 0) + 1);
      }
      setPriceCounts(counts);
    } catch (err) {
      console.error('Failed to load schools:', err);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      if (filterActiveOnly && s.active === false) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q))
        );
      }
      return true;
    });
  }, [schools, filterActiveOnly, searchQuery]);

  const handleToggleActive = async (school: School) => {
    const newStatus = !school.active;
    await db.schools.update(school.id, { active: newStatus });
    await loadSchools();
    showToast(`${school.code} is now ${newStatus ? 'Active' : 'Inactive'}`);
  };

  const catalogMeta = getCatalogTabMeta(storeType);
  const CatalogIcon = catalogMeta.icon;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F] text-white px-5 py-2 rounded-xl shadow-lg border border-[#333336] font-semibold text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#E5E5E7] dark:border-zinc-800 p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E7] dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <CatalogIcon className="w-5 h-5 text-[#1D1D1F] dark:text-zinc-100" />
              <h1 className="font-bold text-xl text-[#1D1D1F] dark:text-zinc-100">{catalogMeta.title}</h1>
            </div>
            <p className="text-xs text-[#86868B] dark:text-zinc-400 mt-0.5">
              Manage custom price multipliers, client accounts, and catalog matrices
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCatalogGenOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F5F5F7] dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-100 border border-[#E5E5E7] dark:border-zinc-700 rounded-xl text-xs font-semibold hover:bg-[#E8E8ED] dark:hover:bg-zinc-700 transition-all shadow-xs cursor-pointer"
              title="Auto-generate products, sizes & rate curves"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#1D1D1F] dark:text-zinc-100" />
              <span>1-Click Catalog</span>
            </button>

            <button
              onClick={() => {
                setSchoolToEdit(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1D1D1F] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-semibold hover:bg-[#333336] dark:hover:bg-white transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add {catalogMeta.entityName}</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
            <div className="text-[10px] uppercase font-bold text-[#86868B]">Total Schools</div>
            <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
              {schools.length} Schools
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7]">
            <div className="text-[10px] uppercase font-bold text-[#86868B]">Active on Counter</div>
            <div className="text-xl font-bold text-[#1D1D1F] mt-0.5">
              {schools.filter(s => s.active !== false).length} Active
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#E5E5E7] col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase font-bold text-[#86868B]">Price Book Multipliers</div>
            <div className="text-sm font-bold text-[#1D1D1F] mt-1">
              Custom Rates Enabled
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E5E5E7]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterActiveOnly(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                !filterActiveOnly
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-[#F5F5F7] text-[#515154] border-[#E5E5E7]'
              }`}
            >
              All Schools ({schools.length})
            </button>
            <button
              onClick={() => setFilterActiveOnly(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                filterActiveOnly
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-[#F5F5F7] text-[#515154] border-[#E5E5E7]'
              }`}
            >
              Active Only
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search school name or code..."
              className="w-full h-8 pl-8 pr-3 rounded-xl border border-[#E5E5E7] text-xs font-medium focus:outline-none focus:border-[#1D1D1F]"
            />
          </div>
        </div>
      </div>

      {/* SCHOOLS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSchools.map(sch => {
          const mappedPrices = priceCounts.get(sch.id) || 0;
          const mult = sch.multiplier || 1.0;

          return (
            <div
              key={sch.id}
              className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                sch.active !== false
                  ? 'border-[#E5E5E7] hover:border-[#D2D2D7]'
                  : 'border-[#E5E5E7] bg-slate-50/70 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] font-bold text-xs border border-[#E5E5E7]">
                      {sch.code}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      sch.active !== false ? 'bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5E7]' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {sch.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSchoolToEdit(sch);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                    title="Edit school details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="font-bold text-sm sm:text-base text-[#1D1D1F] line-clamp-2">
                  {sch.name}
                </h3>

                <div className="mt-3 space-y-1.5 text-xs text-[#515154]">
                  <div className="flex items-center justify-between">
                    <span>Pricing Multiplier:</span>
                    <strong className="text-[#1D1D1F]">{mult}x ({Math.round((mult - 1) * 100)}%)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mapped Price SKUs:</span>
                    <strong className="text-[#1D1D1F]">{mappedPrices} rates</strong>
                  </div>
                  {sch.phone && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <Phone className="w-3 h-3 text-[#86868B]" />
                      <span>{sch.phone}</span>
                    </div>
                  )}
                  {sch.address && (
                    <div className="flex items-center gap-1 text-[11px] truncate">
                      <MapPin className="w-3 h-3 text-[#86868B] shrink-0" />
                      <span className="truncate">{sch.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="mt-4 pt-3 border-t border-[#E5E5E7] flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleActive(sch)}
                  className="text-[11px] font-medium text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                >
                  {sch.active !== false ? 'Set Inactive' : 'Set Active'}
                </button>

                <div className="flex items-center gap-1.5">
                  {onViewSchoolPrices && (
                    <button
                      onClick={() => onViewSchoolPrices(sch.id)}
                      className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] text-xs font-semibold transition-colors cursor-pointer"
                      title="View & Edit Price Matrix for this school"
                    >
                      Rate Card
                    </button>
                  )}

                  {onSelectSchoolForBilling && sch.active !== false && (
                    <button
                      onClick={() => onSelectSchoolForBilling(sch)}
                      className="px-2.5 py-1 rounded-lg bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRight className="w-3 h-3 text-white" />
                      <span>Bill</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSchools.length === 0 && (
        <div className="py-12 text-center bg-white rounded-2xl border border-[#E5E5E7] mt-4">
          <SchoolIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-[#1D1D1F]">No schools match your search</p>
          <button
            onClick={() => {
              setSchoolToEdit(null);
              setIsModalOpen(true);
            }}
            className="mt-3 px-4 py-2 bg-[#1D1D1F] text-white rounded-xl text-xs font-semibold hover:bg-[#333336] transition-colors cursor-pointer"
          >
            + Add New School
          </button>
        </div>
      )}

      {/* School Add/Edit Modal */}
      <SchoolModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSchoolToEdit(null);
        }}
        schoolToEdit={schoolToEdit}
        onSchoolSaved={() => {
          loadSchools();
          showToast(schoolToEdit ? 'School updated' : 'New school added!');
        }}
      />

      {/* 1-Click Catalog Generator Modal */}
      <CatalogGeneratorModal
        isOpen={isCatalogGenOpen}
        onClose={() => setIsCatalogGenOpen(false)}
        schools={schools}
        onGenerated={async () => {
          await loadSchools();
          showToast('1-Click Uniform Catalog generated!');
        }}
      />
    </div>
  );
};
