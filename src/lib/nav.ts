import {
  LayoutDashboard,
  Inbox,
  Users,
  Briefcase,
  FolderKanban,
  CalendarDays,
  CheckSquare,
  ArrowLeftRight,
  Receipt,
  CircleDollarSign,
  LineChart,
  Clapperboard,
  Images,
  Files,
  Plug,
  FileBarChart,
  Bell,
  Settings,
  FileText,
  StickyNote,
  Landmark,
  History,
  Scale,
  ClipboardList,
  FileSignature,
  Table2,
  Wallet,
  Shield,
  Calculator,
  type LucideIcon,
} from "lucide-react";
import type { BusinessOsSectionId } from "@/lib/auth/organization-roles";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  status?: "available" | "planned";
  sectionId?: BusinessOsSectionId;
};

export type DashboardNavGroup = {
  id: string;
  label: string;
  items: DashboardNavItem[];
};

export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    id: "operate",
    label: "Operate",
    items: [
      { href: "/dashboard", label: "Command Center", icon: LayoutDashboard, status: "available", sectionId: "command-center" },
      { href: "/dashboard/crm", label: "CRM & Sales", icon: Users, status: "available", sectionId: "crm" },
      { href: "/dashboard/estimates", label: "Estimates & Proposals", icon: ClipboardList, status: "planned", sectionId: "estimates" },
      { href: "/dashboard/contracts", label: "Contracts & Signatures", icon: FileSignature, status: "planned", sectionId: "contracts" },
      { href: "/dashboard/projects", label: "Projects", icon: FolderKanban, status: "available", sectionId: "projects" },
      { href: "/dashboard/calendar", label: "Calendar & Automations", icon: CalendarDays, status: "available", sectionId: "calendar" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/dashboard/invoices", label: "Invoices & Payments", icon: CircleDollarSign, status: "planned", sectionId: "invoices" },
      { href: "/dashboard/finance", label: "Finance & Accounting", icon: Landmark, status: "available", sectionId: "finance" },
      { href: "/dashboard/sheets", label: "STS Sheets & Charts", icon: Table2, status: "planned", sectionId: "sheets" },
      { href: "/dashboard/taxes", label: "Taxes", icon: Scale, status: "available", sectionId: "taxes" },
      { href: "/dashboard/payroll", label: "Payroll & Contractors", icon: Wallet, status: "planned", sectionId: "payroll" },
    ],
  },
  {
    id: "records",
    label: "Records",
    items: [
      { href: "/dashboard/documents", label: "Documents & Receipts", icon: Files, status: "available", sectionId: "documents" },
      { href: "/dashboard/reports", label: "Reports", icon: FileBarChart, status: "available", sectionId: "reports" },
      { href: "/dashboard/client-portal", label: "Client Portal", icon: Briefcase, status: "planned", sectionId: "client-portal" },
      { href: "/dashboard/accountant", label: "Accountant Center", icon: Calculator, status: "planned", sectionId: "accountant" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug, status: "available", sectionId: "integrations" },
      { href: "/dashboard/security", label: "Security & Ownership", icon: Shield, status: "available", sectionId: "security" },
      { href: "/dashboard/settings/business", label: "Business Settings", icon: Settings, status: "available", sectionId: "business-settings" },
    ],
  },
  {
    id: "workspace-tools",
    label: "Workspace tools",
    items: [
      { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
      { href: "/dashboard/leads", label: "Leads", icon: Users },
      { href: "/dashboard/clients", label: "Clients", icon: Briefcase },
      { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/dashboard/revenue", label: "Income", icon: CircleDollarSign },
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
      { href: "/dashboard/files", label: "Receipts & files", icon: Files },
      { href: "/dashboard/notes", label: "Notes", icon: StickyNote },
      { href: "/dashboard/activity", label: "Activity", icon: History },
      { href: "/dashboard/content", label: "Content Studio", icon: Clapperboard },
      { href: "/dashboard/portfolio", label: "Portfolio", icon: Images },
      { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/settings", label: "All settings", icon: FileText },
    ],
  },
];

export const dashboardNav = dashboardNavGroups.flatMap((group) => group.items);

export const implementedBusinessOsHrefs = dashboardNavGroups
  .filter((group) => group.id !== "workspace-tools")
  .flatMap((group) => group.items)
  .filter((item) => item.status === "available")
  .map((item) => item.href);

export const publicNav = [
  { href: "/work", label: "Work" },
  { href: "/services", label: "Services" },
  { href: "/packages", label: "Packages" },
  { href: "/for/owners", label: "Owners" },
  { href: "/for/creators", label: "Creators" },
  { href: "/contact", label: "Contact" },
];

export const ownersMenu = [
  { href: "/for/owners", label: "For business owners" },
  { href: "/login", label: "Owner login" },
];

export const publicFooterVisit = [
  { href: "/work", label: "Work" },
  { href: "/services", label: "Services" },
  { href: "/packages", label: "Packages" },
  { href: "/about", label: "About" },
  { href: "/process", label: "Process" },
  { href: "/contact", label: "Book a call" },
];

export const publicFooterAudience = [
  { href: "/for/owners", label: "For owners" },
  { href: "/for/creators", label: "For creators" },
  { href: "/resources", label: "Resources" },
  { href: "/lookbook", label: "Color lookbook" },
];

export const publicFooterTrust = [
  { href: "/faq", label: "FAQ" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/rights", label: "Your rights" },
  { href: "/security", label: "Security" },
  { href: "/security/vulnerabilities", label: "Report a vulnerability" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/cookies", label: "Cookies" },
];
