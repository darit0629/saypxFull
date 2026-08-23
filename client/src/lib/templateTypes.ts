export type BindingKey =
  | 'logo_text'
  | 'business_info'
  | 'invoice_meta'
  | 'client_block'
  | 'items_table'
  | 'totals_block'
  | 'notes'
  | 'terms'
  | 'invoice_meta_list'
  | 'totals_simple'
  | 'contact_footer'
  | 'work_for'
  | 'invoice_meta_values'
  | 'items_rows_only'
  | 'totals_values_only'
  | 'website_line';

export const BINDING_LABELS: Record<BindingKey, string> = {
  logo_text: 'Logo / Brand',
  business_info: 'Business Info',
  invoice_meta: 'Invoice Number & Date',
  client_block: 'Bill To (Client)',
  items_table: 'Items Table',
  totals_block: 'Totals',
  notes: 'Notes',
  terms: 'Terms',
  invoice_meta_list: 'Invoice/Customer Details (List)',
  totals_simple: 'Totals (Advance / Grand Total / Due)',
  contact_footer: 'Contact Footer (icons)',
  work_for: 'Work For (Event Date & Location)',
  invoice_meta_values: 'Invoice/Customer Values (no labels)',
  items_rows_only: 'Item Rows Only (no header)',
  totals_values_only: 'Totals Values Only (no labels)',
  website_line: 'Website',
};

export interface TemplateElement {
  id: string;
  type: 'binding' | 'custom_text';
  binding?: BindingKey;
  text?: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  lineHeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  locked?: boolean;
  hidden?: boolean;
}

export interface InvoiceTemplate {
  id: number;
  name: string;
  elements: TemplateElement[];
  background_url: string | null;
  is_default: number;
}

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

let idCounter = 0;
export function newElementId(): string {
  idCounter += 1;
  return `el_${Date.now()}_${idCounter}`;
}

export function defaultElements(): TemplateElement[] {
  const base = {
    rotation: 0,
    fontSize: 13,
    fontWeight: 'normal' as const,
    lineHeight: 1.4,
    color: '#1a1a1a',
    align: 'left' as const,
  };
  return [
    { id: newElementId(), type: 'binding', binding: 'logo_text', label: 'Logo / Brand', x: 40, y: 40, width: 320, height: 50, zIndex: 1, ...base },
    { id: newElementId(), type: 'binding', binding: 'invoice_meta', label: 'Invoice Number & Date', x: 470, y: 40, width: 284, height: 110, zIndex: 2, ...base, align: 'right' },
    { id: newElementId(), type: 'binding', binding: 'client_block', label: 'Bill To (Client)', x: 40, y: 180, width: 350, height: 110, zIndex: 3, ...base },
    { id: newElementId(), type: 'binding', binding: 'items_table', label: 'Items Table', x: 40, y: 320, width: 714, height: 320, zIndex: 4, ...base },
    { id: newElementId(), type: 'binding', binding: 'totals_block', label: 'Totals', x: 450, y: 660, width: 304, height: 160, zIndex: 5, ...base },
    { id: newElementId(), type: 'binding', binding: 'notes', label: 'Notes', x: 40, y: 860, width: 714, height: 40, zIndex: 6, ...base, fontSize: 11 },
    { id: newElementId(), type: 'binding', binding: 'terms', label: 'Terms', x: 40, y: 905, width: 714, height: 40, zIndex: 7, ...base, fontSize: 11 },
  ];
}
