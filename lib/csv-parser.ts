import {
  AUTHORITATIVE_STORE_CATEGORIES,
  CategoryDefinition,
  Product,
  StoreCategoryId,
  StoreCategoryName,
} from './catalog-data';

export interface ParsedProductRow {
  rowNumber: number;
  raw: Record<string, string>;
  name: string;
  categoryInput: string;
  priceInput: string;
  deliveryChargeInput?: string;
  sku: string;
  stockInput: string;
  unit: string;
  description: string;
  dimensions: string;
  materials: string;
  variantsInput: string;
  customImageUrl: string;
  productStatus: string;
  
  // Validation Results
  isValid: boolean;
  hasWarning: boolean;
  errors: string[];
  warnings: string[];
  
  // Resolved Data
  resolvedCategory?: CategoryDefinition;
  resolvedPrice?: number;
  resolvedDeliveryCharge?: number;
  resolvedStock?: number;
  resolvedVariants?: string[];
  resolvedImageUrl?: string;
  
  // Mode B Matching
  matchedExistingProduct?: Product;
}

export interface BulkUploadSummary {
  totalRows: number;
  validRowsCount: number;
  warningRowsCount: number;
  errorRowsCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorsReportCsv?: string;
}

/**
 * Robust RFC 4180 compliant CSV Parser.
 * Handles quoted fields, nested commas, escaped double-quotes (""), 
 * Unicode characters, and multi-line strings cleanly.
 */
export function parseCSVText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  // Normalize Windows CRLF / LF
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped double quote inside quoted field
          currentField += '"';
          i++; // Skip second quote
        } else {
          // End of quoted field
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push final field/row if present
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Converts array of row objects into valid escaped CSV content.
 */
export function generateCSVContent(
  headers: string[],
  rows: Array<Record<string, string | number>>
): string {
  const escapeField = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(',');
  const rowLines = rows.map((row) =>
    headers.map((h) => escapeField(row[h])).join(',')
  );

  return [headerLine, ...rowLines].join('\n');
}

/**
 * Template Column Headers for Citykart Bulk Upload
 */
export const BULK_TEMPLATE_HEADERS = [
  'Product Name',
  'Category',
  'Price (INR)',
  'Delivery Charge (INR)',
  'SKU',
  'Stock Quantity',
  'Unit',
  'Description',
  'Dimensions',
  'Materials',
  'Product Variants',
  'Product Image URL',
  'Product Status',
];

/**
 * Sample rows pre-populated in downloadable template
 */
export const SAMPLE_TEMPLATE_ROWS: Array<Record<string, string | number>> = [
  {
    'Product Name': 'Amul Taaza Toned Milk 1L',
    'Category': 'Grocery & Daily Essentials',
    'Price (INR)': 72,
    'Delivery Charge (INR)': 0,
    'SKU': 'AMUL-TAAZA-1L',
    'Stock Quantity': 50,
    'Unit': '1 Liter',
    'Description': 'Fresh pasteurized toned milk from local dairy',
    'Dimensions': '10x10x20 cm',
    'Materials': 'Toned Milk 3.0% Fat',
    'Product Variants': '500ml; 1L',
    'Product Image URL': 'https://picsum.photos/seed/amul-milk/600/600',
    'Product Status': 'In Stock',
  },
  {
    'Product Name': 'Fresh Organic Alphonsos (1 Dozen)',
    'Category': 'Fruits & Vegetables',
    'Price (INR)': 650,
    'Delivery Charge (INR)': 40,
    'SKU': 'MANGO-ALPHONSO-12P',
    'Stock Quantity': 25,
    'Unit': '1 Dozen (12 Pcs)',
    'Description': 'Naturally ripened Ratnagiri Alphonso mangoes from local orchard',
    'Dimensions': 'Standard Box',
    'Materials': '100% Organic Fruit',
    'Product Variants': '6 Pcs; 12 Pcs',
    'Product Image URL': 'https://picsum.photos/seed/mangoes/600/600',
    'Product Status': 'In Stock',
  },
  {
    'Product Name': 'Pure Cotton Handloom Kurti',
    'Category': 'Fashion & Clothing',
    'Price (INR)': 899,
    'Delivery Charge (INR)': 0,
    'SKU': 'KURTI-COTTON-RED-M',
    'Stock Quantity': 15,
    'Unit': '1 Piece',
    'Description': 'Handmade breathable cotton kurti with traditional ethnic embroidery',
    'Dimensions': 'Chest 38 in, Length 42 in',
    'Materials': '100% Breathable Cotton',
    'Product Variants': 'Small; Medium; Large; XL',
    'Product Image URL': 'https://picsum.photos/seed/kurti-cotton/600/600',
    'Product Status': 'In Stock',
  },
];

/**
 * Generates the official downloadable sample CSV template with comments and instructions.
 */
export function generateSampleCSVTemplate(): string {
  return generateCSVContent(BULK_TEMPLATE_HEADERS, SAMPLE_TEMPLATE_ROWS);
}

/**
 * Helper to match category string input to official Citykart category.
 */
export function resolveCategoryFromInput(
  input?: string | null
): CategoryDefinition | null {
  if (!input || !input.trim()) return null;
  const cleaned = input.trim().toLowerCase();

  // Try exact ID match e.g. cat-01-grocery-daily-essentials
  const byId = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.id.toLowerCase() === cleaned
  );
  if (byId) return byId;

  // Try slug match
  const bySlug = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.slug.toLowerCase() === cleaned
  );
  if (bySlug) return bySlug;

  // Try exact Name match or partial name match
  const byName = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.name.toLowerCase() === cleaned
  );
  if (byName) return byName;

  // Fuzzy match keywords e.g. "grocery", "fruits", "clothing", "electronics", "bakery"
  const fuzzy = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) =>
      c.name.toLowerCase().includes(cleaned) ||
      cleaned.includes(c.name.toLowerCase()) ||
      c.slug.includes(cleaned)
  );
  if (fuzzy) return fuzzy;

  return null;
}

/**
 * Validates image URL format (must be absolute http:// or https:// URL).
 */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return true; // Optional field
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}
