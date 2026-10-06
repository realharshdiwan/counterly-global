import { type StoreBusinessType } from '../types';
import { School as SchoolIcon, BookOpen } from 'lucide-react';

export function getCatalogTabMeta(storeType?: StoreBusinessType) {
  if (storeType === 'uniform') {
    return {
      label: 'Schools',
      title: 'Schools & Institutions Master',
      selectorLabel: 'Select School',
      switchLabel: 'Switch School',
      searchPlaceholder: 'Search by school name or code...',
      entityName: 'School',
      icon: SchoolIcon,
    };
  }
  return {
    label: 'Price Books',
    title: 'Price Books & Catalog Matrices',
    selectorLabel: 'Select Price Book',
    switchLabel: 'Switch Price Book',
    searchPlaceholder: 'Search by price book or catalog code...',
    entityName: 'Price Book',
    icon: BookOpen,
  };
}
