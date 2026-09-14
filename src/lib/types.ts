export type Role =
  | "owner"
  | "admin"
  | "coo"
  | "executive_assistant"
  | "content_strategist"
  | "scriptwriter"
  | "reviewer"
  | "contractor"
  | "accountant"
  | "client";

export type PublishStatus = "draft" | "review" | "approved" | "published" | "archived";
export type LeadStage =
  | "new_inquiry"
  | "contacted"
  | "discovery_scheduled"
  | "discovery_completed"
  | "proposal_sent"
  | "negotiating"
  | "won"
  | "lost"
  | "nurture";

export type ProjectStage =
  | "lead"
  | "awaiting_deposit"
  | "discovery"
  | "waiting_for_content"
  | "wireframe"
  | "in_development"
  | "internal_review"
  | "client_review"
  | "revisions"
  | "ready_to_launch"
  | "launched"
  | "maintenance"
  | "on_hold"
  | "completed";

export type InvoiceStatus = "draft" | "sent" | "viewed" | "partial" | "paid" | "overdue" | "void";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed";
export type ReceiptStatus = "missing" | "attached" | "needs_review";
export type IntegrationStatus = "connected" | "needs_setup" | "error" | "coming_soon";
export type ContentStatus = "draft" | "review" | "approved" | "scheduled" | "published";
export type EventKind =
  | "team_meeting"
  | "client_meeting"
  | "deadline"
  | "follow_up"
  | "content"
  | "invoice_due"
  | "domain_renewal"
  | "subscription_renewal"
  | "task";

export type DatePreset = "today" | "7d" | "30d" | "quarter" | "year" | "custom";

export type EntityType = "llc" | "sole_prop" | "c_corp" | "s_corp" | "nonprofit" | "other";
export type FederalClassification = "tbd" | "disregarded_entity" | "partnership" | "c_corp" | "s_corp" | "other";
export type AccountingMethod = "cash" | "accrual";
export type FiscalYearType = "calendar" | "fiscal";
export type SCorpStatus = "not_elected" | "elected" | "undecided";
export type NoteRelatedType = "client" | "project" | "lead" | "none";
export type OsDocumentCategory = "contract" | "formation" | "tax" | "insurance" | "other";
export type OsTransactionKind =
  | "income"
  | "expense"
  | "owner_draw"
  | "owner_contribution"
  | "transfer"
  | "adjustment";
export type OsTransactionSource = "expense_ledger" | "revenue_ledger" | "manual";
export type TaxChecklistStatus = "todo" | "in_progress" | "done" | "not_applicable";

export interface BusinessProfile {
  legalName: string;
  dba: string;
  entityType: EntityType;
  federalClassification: FederalClassification;
  formationState: string;
  accountingMethod: AccountingMethod;
  fiscalYearType: FiscalYearType;
  fiscalYearStartMonth: number;
  timezone: string;
  currency: string;
  website: string;
  publicEmail: string;
  ownerEmail: string;
  taxReservePercent: number;
  reservedTaxAmountCents: number;
  invoiceNumberFormat: string;
  defaultPaymentTerms: string;
  defaultDepositPercent: number;
  sCorpStatus: SCorpStatus;
  sCorpNotes: string;
  einStored: false;
  notes: string;
}

export interface OwnerNote {
  id: string;
  title: string;
  body: string;
  relatedType: NoteRelatedType;
  relatedId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OsDocument {
  id: string;
  name: string;
  category: OsDocumentCategory;
  relatedType: "client" | "project" | "none";
  relatedId: string | null;
  notes: string;
  storagePath: string | null;
  createdAt: string;
}

export interface OsTransaction {
  id: string;
  date: string;
  kind: OsTransactionKind;
  source: OsTransactionSource;
  sourceId: string | null;
  description: string;
  amountCents: number;
  currency: string;
  clientId: string | null;
  projectId: string | null;
  category: string;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxChecklistItem {
  id: string;
  taxYear: number;
  title: string;
  notes: string;
  dueDate: string | null;
  status: TaxChecklistStatus;
  ownerEntered: boolean;
}

export interface DashboardPreferences {
  hiddenCards: string[];
  cardOrder: string[];
}

export interface BrandSettings {
  legalName: string;
  shortName: string;
  website: string;
  mission: string;
  brandStatement: string;
  founderName: string;
  founderRole: string;
  founderBio: string;
  email: string;
  phone: string;
  instagram: string;
  linkedin: string;
  facebook: string;
  tiktok: string;
  calendlyUrl: string;
  accentColor: string;
  paletteId: string;
  logoText: string;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  active: boolean;
  featured: boolean;
  order: number;
}

export interface PackageItem {
  id: string;
  name: string;
  description: string;
  setupPrice: number | null;
  monthlyPrice: number | null;
  included: string[];
  deliveryEstimate: string;
  addOns: string[];
  featured: boolean;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
  notes: string;
}

export interface PortfolioItem {
  id: string;
  slug: string;
  companyName: string;
  industry: string;
  projectTitle: string;
  serviceProvided: string;
  challenge: string;
  solution: string;
  deliverables: string[];
  websiteUrl: string;
  startDate: string;
  endDate: string;
  testimonialId: string | null;
  results: string[];
  featured: boolean;
  status: PublishStatus;
  beforeImageLabel: string;
  afterImageLabel: string;
  desktopLabel: string;
  mobileLabel: string;
  videoUrl: string;
  tags: string[];
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string;
  company: string;
  quote: string;
  approved: boolean;
  published: boolean;
  source: string;
  relatedPortfolioId: string | null;
}

export interface ProcessStep {
  id: string;
  title: string;
  summary: string;
  detail: string;
  order: number;
}

export interface LegalPage {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  lastReviewed: string | null;
  needsProfessionalReview: boolean;
}

export interface ContactSubmission {
  id: string;
  createdAt: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  service: string;
  budget: string;
  preferredContact: string;
  message: string;
  consent: boolean;
  fileName: string | null;
  status: "new" | "reviewed";
}

export interface ClientRecord {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  status: "active" | "paused" | "archived";
  portalEnabled: boolean;
  notes: string;
}

export interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  requestedService: string;
  estimatedValue: number;
  probability: number;
  stage: LeadStage;
  lastContact: string | null;
  nextFollowUp: string | null;
  callsMade: number;
  emailsSent: number;
  meetings: number;
  notes: string;
  assignedTo: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  packageId: string | null;
  stage: ProjectStage;
  startDate: string;
  deadline: string;
  budget: number;
  amountInvoiced: number;
  amountCollected: number;
  directCost: number;
  githubRepo: string;
  vercelProject: string;
  productionUrl: string;
  domain: string;
  maintenancePlan: string;
  credentialsReference: string;
  notes: string;
  atRisk: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  projectId: string | null;
  clientId: string | null;
  dueDate: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  assignee: string;
  notes: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  status: "upcoming" | "complete" | "missed";
}

export interface CalendarEvent {
  id: string;
  title: string;
  kind: EventKind;
  start: string;
  end: string;
  notes: string;
  relatedId: string | null;
  location: string;
}

export interface Expense {
  id: string;
  transactionDate: string;
  postedDate: string;
  vendor: string;
  description: string;
  pretaxAmount: number;
  salesTax: number;
  totalAmount: number;
  currency: string;
  category: string;
  subcategory: string;
  clientId: string | null;
  projectId: string | null;
  businessPurpose: string;
  paymentAccount: string;
  paymentMethod: string;
  recurring: boolean;
  billingFrequency: "one_time" | "monthly" | "yearly";
  receiptName: string | null;
  receiptStatus: ReceiptStatus;
  reimbursable: boolean;
  reimbursementStatus: "n/a" | "pending" | "reimbursed";
  directProjectCost: boolean;
  taxReviewStatus: "needs_review" | "reviewed" | "hold";
  deductibilityStatus: "unknown" | "likely_deductible" | "not_deductible" | "partial";
  taxYear: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  confirmationStatus: "draft" | "confirmed";
  demoLabel: boolean;
}

export interface RecurringExpenseTemplate {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  category: string;
  frequency: "monthly" | "yearly";
  nextDue: string;
  active: boolean;
}

export interface RevenueEntry {
  id: string;
  date: string;
  type:
    | "one_time_project"
    | "deposit"
    | "final_payment"
    | "recurring_maintenance"
    | "add_on"
    | "refund"
    | "discount"
    | "tax_collected"
    | "processing_fee";
  description: string;
  amount: number;
  currency: string;
  clientId: string | null;
  projectId: string | null;
  service: string;
  invoiceStatus: InvoiceStatus;
  paymentStatus: PaymentStatus;
  dueDate: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  recognized: boolean;
  notes: string;
  demoLabel: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  projectId: string | null;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
}

export interface SubscriptionRecord {
  id: string;
  clientId: string;
  projectId: string | null;
  name: string;
  monthlyAmount: number;
  status: "active" | "paused" | "canceled" | "draft";
  startDate: string;
  stripeSubscriptionId: string;
}

export interface ContentItem {
  id: string;
  title: string;
  caption: string;
  hook: string;
  cta: string;
  hashtags: string[];
  platform: "instagram" | "tiktok" | "facebook" | "linkedin" | "sts_site";
  pillar: string;
  campaign: string;
  status: ContentStatus;
  publishDate: string | null;
  assignedCreator: string;
  reviewer: string;
  notes: string;
  assetLabel: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  requireManualReview: boolean;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  lastSync: string | null;
  lastError: string | null;
  href: string;
  phase: 1 | 2 | 3;
  oauth: boolean;
  quickLink?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href: string;
  kind: "info" | "warning" | "success";
}

export interface FileRecord {
  id: string;
  name: string;
  kind: "receipt" | "client" | "content" | "internal";
  relatedTo: string;
  visibility: "private" | "client";
  uploadedAt: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "invited" | "disabled";
  mfaRequired: boolean;
  mfaEnrolled: boolean;
}

export interface SecurityEvent {
  id: string;
  at: string;
  type:
    | "login_success"
    | "login_failed"
    | "password_reset_request"
    | "password_change"
    | "email_change"
    | "mfa_enroll"
    | "mfa_remove"
    | "recovery_attempt"
    | "new_session"
    | "session_revoked"
    | "role_change"
    | "invitation"
    | "rate_limited"
    | "vulnerability_report";
  actor: string;
  detail: string;
}

export interface SessionRecord {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  module: "expenses" | "revenue" | "leads" | "projects";
  query: string;
}

export interface Budget {
  id: string;
  category: string;
  year: number;
  monthlyLimit: number;
}

export interface Vendor {
  id: string;
  name: string;
  defaultCategory: string;
}

export interface DomainRecord {
  id: string;
  domain: string;
  expiresOn: string;
  registrar: string;
  notes: string;
}

export interface DeploymentRecord {
  id: string;
  projectName: string;
  environment: "preview" | "production";
  status: "success" | "failed" | "building";
  url: string;
  at: string;
}

export interface WorkspaceState {
  brand: BrandSettings;
  businessProfile: BusinessProfile;
  notes: OwnerNote[];
  osDocuments: OsDocument[];
  osTransactions: OsTransaction[];
  taxChecklist: TaxChecklistItem[];
  dashboardPreferences: DashboardPreferences;
  services: Service[];
  packages: PackageItem[];
  portfolio: PortfolioItem[];
  testimonials: Testimonial[];
  process: ProcessStep[];
  legal: LegalPage[];
  contacts: ContactSubmission[];
  clients: ClientRecord[];
  leads: Lead[];
  projects: Project[];
  tasks: TaskItem[];
  milestones: Milestone[];
  events: CalendarEvent[];
  expenses: Expense[];
  recurringExpenses: RecurringExpenseTemplate[];
  revenue: RevenueEntry[];
  invoices: Invoice[];
  subscriptions: SubscriptionRecord[];
  content: ContentItem[];
  emailTemplates: EmailTemplate[];
  integrations: Integration[];
  notifications: NotificationItem[];
  files: FileRecord[];
  auditLog: AuditEvent[];
  team: TeamMember[];
  securityEvents: SecurityEvent[];
  sessions: SessionRecord[];
  savedViews: SavedView[];
  budgets: Budget[];
  vendors: Vendor[];
  domains: DomainRecord[];
  deployments: DeploymentRecord[];
  websiteTraffic: { date: string; visits: number; conversions: number }[];
  emailsSentCount: number;
  callsMadeCount: number;
}

export const EXPENSE_CATEGORIES = [
  "Software and SaaS subscriptions",
  "AI tools",
  "Website hosting",
  "Domains and DNS",
  "Cloud and database services",
  "Email and communication",
  "Advertising",
  "Marketing",
  "Social media",
  "Contractors and freelancers",
  "Payroll",
  "Legal services",
  "Accounting and bookkeeping",
  "Consulting",
  "Business registration and licenses",
  "Registered-agent fees",
  "Insurance",
  "Bank fees",
  "Payment-processing fees",
  "Office supplies",
  "Computer equipment",
  "Cameras and production equipment",
  "Repairs and maintenance",
  "Phone",
  "Internet",
  "Education and training",
  "Conferences and events",
  "Airfare",
  "Lodging",
  "Rental vehicles",
  "Rideshare and transportation",
  "Mileage",
  "Gas",
  "Parking",
  "Tolls",
  "Business meals",
  "Coworking and office rent",
  "Virtual mailbox",
  "Shipping and postage",
  "Client gifts",
  "Taxes and government fees",
  "Miscellaneous",
  "Needs review",
] as const;

export const LEAD_STAGES: LeadStage[] = [
  "new_inquiry",
  "contacted",
  "discovery_scheduled",
  "discovery_completed",
  "proposal_sent",
  "negotiating",
  "won",
  "lost",
  "nurture",
];

export const PROJECT_STAGES: ProjectStage[] = [
  "lead",
  "awaiting_deposit",
  "discovery",
  "waiting_for_content",
  "wireframe",
  "in_development",
  "internal_review",
  "client_review",
  "revisions",
  "ready_to_launch",
  "launched",
  "maintenance",
  "on_hold",
  "completed",
];
