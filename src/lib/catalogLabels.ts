import { type StoreBusinessType } from '../types';
import { School as SchoolIcon, Shirt, Scissors, Footprints, ShoppingBag } from 'lucide-react';

export interface CatalogMeta {
  label: string;
  title: string;
  selectorLabel: string;
  switchLabel: string;
  searchPlaceholder: string;
  entityName: string;
  icon: any;
  productNoun: string;
  productNounPlural: string;
  categoryNoun: string;
  invoiceSectionTitle: string;
  customerProfileNoun: string;
  pastSizesNoun: string;
  showSchoolFields: boolean;
  defaultCategories: { id: string; name: string; sort_order: number }[];
}

export function getCatalogTabMeta(storeType?: StoreBusinessType): CatalogMeta {
  if (storeType === 'uniform') {
    return {
      label: 'Accounts',
      title: 'Institutional & School Accounts',
      selectorLabel: 'Select Account',
      switchLabel: 'Switch Account',
      searchPlaceholder: 'Search by school or account code...',
      entityName: 'Account',
      icon: SchoolIcon,
      productNoun: 'Uniform Item',
      productNounPlural: 'Uniform Items',
      categoryNoun: 'Category',
      invoiceSectionTitle: 'Customer & Account Details',
      customerProfileNoun: 'Fit Profile',
      pastSizesNoun: 'Fit & Size History',
      showSchoolFields: true,
      defaultCategories: [
        { id: 'uniform', name: 'Uniform Sets', sort_order: 1 },
        { id: 'winterwear', name: 'Outerwear', sort_order: 2 },
        { id: 'accessories', name: 'Accessories', sort_order: 3 },
        { id: 'footwear', name: 'Footwear', sort_order: 4 },
      ],
    };
  }

  const defaultMeta = {
    categoryNoun: 'Category',
    invoiceSectionTitle: 'Customer Details',
    customerProfileNoun: 'Customer Profile',
    pastSizesNoun: 'Fit & Size Notes',
    showSchoolFields: false,
  };

  if (storeType === 'boutique') {
    return {
      label: 'Catalog',
      title: 'Boutique Catalog & Variants',
      selectorLabel: 'Select Category',
      switchLabel: 'Switch Category',
      searchPlaceholder: 'Search products, SKUs, or barcodes...',
      entityName: 'Category',
      icon: Scissors,
      productNoun: 'Garment / Service',
      productNounPlural: 'Garments & Services',
      ...defaultMeta,
      defaultCategories: [
        { id: 'tops', name: 'Tops & Dresses', sort_order: 1 },
        { id: 'bottoms', name: 'Trousers & Skirts', sort_order: 2 },
        { id: 'stitching', name: 'Tailoring & Alterations', sort_order: 3 },
        { id: 'accessories', name: 'Accessories', sort_order: 4 },
      ],
    };
  }

  if (storeType === 'footwear') {
    return {
      label: 'Catalog',
      title: 'Footwear Catalog & Variants',
      selectorLabel: 'Select Category',
      switchLabel: 'Switch Category',
      searchPlaceholder: 'Search shoes, SKUs, or barcodes...',
      entityName: 'Category',
      icon: Footprints,
      productNoun: 'Footwear Item',
      productNounPlural: 'Footwear & Care',
      ...defaultMeta,
      defaultCategories: [
        { id: 'sneakers', name: 'Sneakers & Athletic', sort_order: 1 },
        { id: 'formal', name: 'Formal & Leather', sort_order: 2 },
        { id: 'casual', name: 'Sandals & Casual', sort_order: 3 },
        { id: 'accessories', name: 'Socks & Care', sort_order: 4 },
      ],
    };
  }

  return {
    label: 'Catalog',
    title: 'Retail Catalog & Variants',
    selectorLabel: 'Select Category',
    switchLabel: 'Switch Category',
    searchPlaceholder: 'Search products, SKUs, or barcodes...',
    entityName: 'Category',
    icon: storeType === 'general' ? ShoppingBag : Shirt,
    productNoun: 'Product',
    productNounPlural: 'Products & Variants',
    ...defaultMeta,
    defaultCategories: [
      { id: 'tops', name: 'Tops & Shirts', sort_order: 1 },
      { id: 'bottoms', name: 'Bottoms & Denim', sort_order: 2 },
      { id: 'footwear', name: 'Footwear', sort_order: 3 },
      { id: 'accessories', name: 'Accessories', sort_order: 4 },
    ],
  };
}
