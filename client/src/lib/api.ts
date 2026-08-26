// A 401 mid-session (the cookie expired, or the server restarted with a new
// SESSION_SECRET) used to just throw a generic error that individual pages
// often swallowed or displayed poorly — e.g. Mail would just look "broken"
// with no indication you'd simply been logged out. Redirect straight to
// /login instead, except for the two auth endpoints themselves, where a 401
// is an expected, meaningful response (not logged in yet / wrong password).
function handleUnauthorized(url: string, status: number) {
  if (status !== 401) return;
  if (url === '/api/auth/me' || url === '/api/auth/login') return;
  if (window.location.pathname === '/login') return;
  window.location.href = '/login';
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  handleUnauthorized(url, res.status);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
};

// Multipart upload — separate from `request()` since that always sets
// Content-Type: application/json. Letting fetch set its own multipart
// boundary header is required for FormData bodies to parse server-side.
export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: formData });
  handleUnauthorized(url, res.status);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---- Types ----
export interface Client {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  business_name: string | null;
  gstin: string | null;
  notes: string | null;
  total_revenue?: number;
  total_due?: number;
  invoice_count?: number;
}

export interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit?: string | null;
  rate: number;
  amount?: number;
}

export interface Invoice {
  id: number;
  client_id: number | null;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;
  invoice_number: string;
  invoice_date: number;
  due_date: number | null;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  received_amount: number;
  due_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
  display_status: 'paid' | 'partial' | 'unpaid' | 'overdue';
  notes: string | null;
  terms: string | null;
  event_date: number | null;
  event_location: string | null;
  items: InvoiceItem[];
}

export interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCounts: { total: number; paid: number; due: number; overdue: number };
  recentTransactions: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    date: number;
    amount: number;
    status: string;
  }[];
}

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string | null;
  expense_date: number;
  notes: string | null;
}

// ---- Mail types ----
export interface MailAddress {
  address: string;
  name?: string | null;
}

export interface MailListItem {
  id: number;
  folder: string;
  message_id: string | null;
  subject: string;
  from_address: string | null;
  from_name: string | null;
  date_ts: number;
  snippet: string | null;
  has_attachments: boolean;
  is_read: boolean;
}

export interface MailAttachment {
  id: number;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
}

export interface MailMessage extends MailListItem {
  in_reply_to: string | null;
  references_header: string | null;
  to_addresses: MailAddress[];
  cc_addresses: MailAddress[];
  body_text: string | null;
  body_html: string | null;
  attachments: MailAttachment[];
}

export interface MailFolder {
  folder: string;
  total: number;
  unreadCount: number;
}

// ---- Website (photography site) types ----
export interface PortfolioItem {
  _index: number;
  category: string;
  orientation: string;
  type?: 'video';
  src?: string;
  video?: string;
  poster?: string;
  alt: string;
  title: string;
  subtitle: string;
}

export type PortfolioCategories = Record<string, string>;

export type AlbumStatus = 'DRAFT' | 'PROCESSING' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type PageMode = 'SINGLE_PAGE' | 'FULL_SPREAD';

export interface DigitalAlbum {
  id: number;
  title: string;
  client_name: string | null;
  event_type: string | null;
  event_date: number | null;
  photographer_name: string | null;
  description: string | null;
  public_code: string;
  page_mode: PageMode;
  status: AlbumStatus;
  cover_image_id: number | null;
  back_cover_image_id: number | null;
  cover_thumbnail: string | null;
  public_url: string;
  allow_download: boolean;
  allow_share: boolean;
  sound_enabled: boolean;
  watermark_enabled: boolean;
  compress_images: boolean;
  view_count: number;
  spread_count: number | null;
  page_count: number;
  background_music_path: string | null;
  audio_mode: 'page-flip-sound-only' | 'music-only' | 'both' | 'silent';
  music_volume: number;
  music_loop: number;
  loading_tagline: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
  pages?: AlbumPage[];
  coverImage?: AlbumImageRef | null;
  backCoverImage?: AlbumImageRef | null;
}

export interface AlbumImageRef {
  id: number;
  thumbnail_path: string;
  display_path: string;
}

export interface AlbumPage {
  id: number;
  album_id: number;
  page_number: number;
  spread_number: number | null;
  sort_order: number;
  image_id: number;
  thumbnail_path: string;
  display_path: string;
  width: number;
  height: number;
  center_x_pct: number;
}

export type CustomerStatus = 'ACTIVE' | 'DISABLED';

export interface PhotoBookCustomer {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  businessName: string | null;
  status: CustomerStatus;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
}

export type PlanType = 'FIXED' | 'CUSTOM';

export interface PlanDurationOption {
  durationDays: number;
  // Always equal to the parent plan's own `credits` - a longer duration
  // tier never grants more album credits, only longer validity at a
  // different (usually better) price. Server-enforced, not just a display
  // convention - see photobookPlans.js's validateDurationOptions.
  credits: number;
  basePricePaise: number;
  discountPaise: number;
  finalPricePaise: number;
}

export interface PhotoBookPlan {
  id: number;
  name: string;
  planType: PlanType;
  credits: number;
  durationDays: number;
  basePricePaise: number;
  discountPaise: number;
  finalPricePaise: number;
  minCredits: number | null;
  pricePerCreditPaise: number | null;
  discountPerCreditPaise: number | null;
  durationOptions: PlanDurationOption[];
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export type PackageStatus = 'PENDING' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
export type PackageOverrideStatus = 'SUSPENDED' | 'CANCELLED' | 'FORCE_ACTIVE' | null;

export interface PhotoBookPackage {
  id: number;
  customer: { id: number; email: string; name: string | null; businessName: string | null } | null;
  plan: PhotoBookPlan | null;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  startsAt: number | null;
  expiresAt: number | null;
  computedStatus: PackageStatus;
  adminOverrideStatus: PackageOverrideStatus;
  adminOverrideReason: string | null;
  adminOverrideBy: string | null;
  adminOverrideAt: number | null;
  createdAt: number;
  updatedAt: number;
  auditLog?: { id: number; action: string; before_json: string | null; after_json: string | null; reason: string | null; performed_by: string; created_at: number }[];
  ledger?: { id: number; type: string; amount: number; balance_after: number; note: string | null; created_at: number }[];
}

export interface CustomerPackageView {
  id: number;
  plan: PhotoBookPlan | null;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  startsAt: number | null;
  expiresAt: number | null;
  status: PackageStatus | 'SUSPENDED' | 'CANCELLED';
  topupPricePerCreditPaise: number | null;
  // What was actually paid/for how long, for the order that created or most
  // recently renewed this package - can differ from plan.finalPricePaise/
  // durationDays if a longer-duration tier was bought instead of the plan's
  // primary one.
  purchasedAmountPaise: number | null;
  purchasedDurationDays: number | null;
}

export interface PhotoBookOrder {
  id: number;
  customer: { id: number; email: string; name: string | null; businessName: string | null } | null;
  plan: PhotoBookPlan | null;
  amountPaise: number;
  razorpayOrderId: string;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'CANCELLED';
  createdAt: number;
  updatedAt: number;
  payments?: { id: number; razorpayPaymentId: string; status: 'CAPTURED' | 'FAILED'; createdAt: number }[];
}

export interface PhotoBookPayment {
  id: number;
  razorpayPaymentId: string;
  status: 'CAPTURED' | 'FAILED';
  createdAt: number;
  order: {
    id: number;
    razorpayOrderId: string;
    amountPaise: number;
    status: PhotoBookOrder['status'];
    customer: { id: number; email: string; name: string | null; businessName: string | null } | null;
    plan: { id: number; name: string } | null;
  } | null;
}

export type CreditTransactionType =
  | 'PACKAGE_PURCHASE'
  | 'ALBUM_CREATED'
  | 'ALBUM_DELETED'
  | 'CREDIT_REFUND'
  | 'ADMIN_ADJUSTMENT'
  | 'PACKAGE_EXPIRY'
  | 'PACKAGE_RENEWAL';

export interface CreditTransaction {
  id: number;
  customer: { id: number; email: string; name: string | null; businessName: string | null } | null;
  package: { id: number; plan: { id: number; name: string } | null } | null;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  actorType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  actorId: string | null;
  note: string | null;
  createdAt: number;
}

export interface PhotoBookSettings {
  expiringSoonDays: number;
  topupPricePerCreditPaise: number | null;
  updatedAt: number;
}

export function formatMoney(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// Package/plan prices are stored as integer paise (never float rupees) to avoid
// rounding drift in a payments system - this is the one place that converts
// for display.
export function formatPaise(paise: number): string {
  return formatMoney(paise / 100);
}

export function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Average Gregorian month length - used to convert between the day counts
// plans/packages are actually stored/computed in (precise, no drift across
// leap years) and the years/months an admin enters or a customer reads.
const DAYS_PER_MONTH = 30.4375;

export function monthsToDays(months: number): number {
  return Math.round(months * DAYS_PER_MONTH);
}

export function daysToMonths(days: number): number {
  return Math.round(days / DAYS_PER_MONTH);
}

// Plan/package durations are always stored as a day count (precise, no
// calendar drift) - this is the one place that renders one as "1 year 6
// months" for display. Falls back to raw days under a month, where a
// years/months phrasing would be nonsensical ("0 months").
export function formatDuration(days: number): string {
  if (!Number.isFinite(days)) return '—';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
  const totalMonths = Math.round(days / DAYS_PER_MONTH);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' ') : '0 months';
}
