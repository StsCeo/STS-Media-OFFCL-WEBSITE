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
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type DashboardNavGroup = {
  id: string;
  label: string;
  items: DashboardNavItem[];
};

export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Command Center", icon: LayoutDashboard },
      { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { href: "/dashboard/leads", label: "Leads", icon: Users },
      { href: "/dashboard/clients", label: "Clients", icon: Briefcase },
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    items: [
      { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/dashboard/revenue", label: "Income", icon: CircleDollarSign },
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
      { href: "/dashboard/finance", label: "Finance", icon: Landmark },
      { href: "/dashboard/files", label: "Receipts & files", icon: Files },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { href: "/dashboard/documents", label: "Documents", icon: FileText },
      { href: "/dashboard/notes", label: "Notes", icon: StickyNote },
      { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
      { href: "/dashboard/taxes", label: "Taxes", icon: Scale },
      { href: "/dashboard/activity", label: "Activity", icon: History },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "studio",
    label: "Studio",
    items: [
      { href: "/dashboard/content", label: "Content Studio", icon: Clapperboard },
      { href: "/dashboard/portfolio", label: "Portfolio", icon: Images },
      { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

export const dashboardNav = dashboardNavGroups.flatMap((group) => group.items);

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

export const publicFooterGroups = [
  {
    label: "Work",
    links: [
      { href: "/work", label: "Selected work" },
      { href: "/work/state-collision-pro", label: "State Collision Pro" },
      { href: "/lookbook", label: "Color lookbook" },
      { href: "/testimonials", label: "Testimonials" },
    ],
  },
  {
    label: "Services",
    links: [
      { href: "/services", label: "All services" },
      { href: "/packages", label: "Packages" },
      { href: "/process", label: "Process" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/for/owners", label: "For owners" },
      { href: "/for/creators", label: "For creators" },
      { href: "/resources", label: "Resources" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/portal", label: "Client access" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/cookies", label: "Cookies" },
      { href: "/legal/accessibility", label: "Accessibility statement" },
      { href: "/accessibility", label: "Accessibility" },
      { href: "/rights", label: "Your rights" },
      { href: "/security", label: "Security" },
      { href: "/security/vulnerabilities", label: "Report a vulnerability" },
      { href: "/security/acknowledgments", label: "Acknowledgments" },
    ],
  },
];
