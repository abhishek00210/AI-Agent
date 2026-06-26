"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  CreditCard,
  FileText,
  FileAudio,
  Globe2,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Phone,
  PhoneCall,
  PhoneForwarded,
  MessageCircle,
  MessageSquareText,
  Search,
  Settings,
  Shield,
  Sun,
  UserRound,
  UsersRound,
  Wrench,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@ai-agent-platform/ui";
import { authApi } from "@/lib/auth-api";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Array<"OWNER" | "ADMIN" | "MEMBER">;
};

type NavSection = {
  label: string;
  items: Array<NavItem & { children?: NavItem[] }>;
};

const navigation: NavSection[] = [
  {
    label: "Workspace",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Build",
    items: [
      {
        href: "/agents",
        label: "Agents",
        icon: Bot,
        children: [{ href: "/agents", label: "All Agents", icon: Bot }],
      },
      {
        href: "/knowledge-bases",
        label: "Knowledge Base",
        icon: BookOpen,
        children: [
          { href: "/knowledge-bases", label: "Knowledge Bases", icon: BookOpen },
          { href: "/documents", label: "Documents", icon: FileText },
          { href: "/website-sources", label: "Websites", icon: Globe2 },
          { href: "/faqs", label: "FAQs", icon: HelpCircle },
        ],
      },
      {
        href: "/widgets",
        label: "Widgets",
        icon: MessageCircle,
        children: [{ href: "/widgets", label: "Website Widgets", icon: MessageCircle }],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/conversations",
        label: "Conversations",
        icon: Activity,
        children: [{ href: "/conversations", label: "Chat History", icon: Activity }],
      },
      {
        href: "/communications",
        label: "Communications",
        icon: MessageSquareText,
        children: [{ href: "/communications", label: "SMS", icon: MessageSquareText }],
      },
      {
        href: "/voice/calls",
        label: "Voice",
        icon: PhoneCall,
        children: [
          { href: "/voice/calls", label: "Calls", icon: PhoneCall },
          { href: "/outbound-calls", label: "Outbound AI Calls", icon: PhoneCall },
          { href: "/campaigns", label: "Campaigns", icon: UsersRound },
          { href: "/voice/recordings", label: "Recordings", icon: FileAudio },
          { href: "/voice/transcripts", label: "Transcripts", icon: FileText },
          { href: "/voice/phone-numbers", label: "Phone Numbers", icon: Phone },
          { href: "/voice/existing-numbers", label: "Existing Numbers", icon: PhoneForwarded },
          { href: "/voice/port-requests", label: "Port Requests", icon: Phone },
        ],
      },
      {
        href: "/tools",
        label: "Tools",
        icon: Wrench,
        children: [{ href: "/tools", label: "AI Actions", icon: Wrench }],
      },
      {
        href: "/automations",
        label: "Automations",
        icon: Workflow,
        children: [
          { href: "/automations", label: "My Workflows", icon: Workflow },
          { href: "/automations/templates", label: "Template Library", icon: BookOpen },
          { href: "/automations/builder", label: "Workflow Builder", icon: Wrench },
        ],
      },
      {
        href: "/leads",
        label: "Leads",
        icon: UsersRound,
        children: [
          { href: "/customers", label: "Customers", icon: CircleUserRound },
          { href: "/leads", label: "Leads", icon: UsersRound },
          { href: "/leads/imports", label: "Lead Imports", icon: FileText },
          { href: "/contacts", label: "Contacts", icon: CircleUserRound },
        ],
      },
      {
        href: "/appointments/calendar",
        label: "Appointments",
        icon: CalendarDays,
        children: [
          { href: "/appointments/calendar", label: "Calendar", icon: CalendarDays },
          { href: "/appointments/bookings", label: "Bookings", icon: FileText },
        ],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        children: [{ href: "/analytics", label: "Overview", icon: BarChart3 }],
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/settings/organization",
        label: "Settings",
        icon: Settings,
        children: [
          { href: "/settings/organization", label: "Organization", icon: UsersRound },
          { href: "/settings/profile", label: "Profile", icon: UserRound },
          { href: "/settings/security", label: "Security", icon: LockKeyhole },
        ],
      },
      {
        href: "/billing",
        label: "Billing",
        icon: CreditCard,
        roles: ["OWNER", "ADMIN"],
        children: [
          { href: "/billing", label: "Subscription", icon: CreditCard },
          { href: "/plans", label: "Plans", icon: CreditCard },
          { href: "/usage", label: "Usage", icon: Gauge },
        ],
      },
    ],
  },
];

const pageTitles = new Map<string, string>([
  ["/dashboard", "Dashboard"],
  ["/agents", "Agents"],
  ["/knowledge-bases", "Knowledge Bases"],
  ["/documents", "Documents"],
  ["/knowledge/documents", "Documents"],
  ["/knowledge/websites", "Websites"],
  ["/website-sources", "Websites"],
  ["/faqs", "FAQs"],
  ["/widgets", "Widgets"],
  ["/conversations", "Conversations"],
  ["/conversations/history", "Chat history"],
  ["/communications", "Communications"],
  ["/voice", "Voice"],
  ["/voice/calls", "Calls"],
  ["/outbound-calls", "Outbound AI calls"],
  ["/campaigns", "Outbound campaigns"],
  ["/voice/recordings", "Recordings"],
  ["/voice/transcripts", "Transcripts"],
  ["/voice/phone-numbers", "Phone numbers"],
  ["/voice/existing-numbers", "Existing numbers"],
  ["/voice/port-requests", "Port requests"],
  ["/tools", "Tools"],
  ["/automations", "Automations"],
  ["/automations/templates", "Workflow Templates"],
  ["/automations/builder", "Workflow Builder"],
  ["/leads", "Leads"],
  ["/contacts", "Contacts"],
  ["/appointments/calendar", "Calendar"],
  ["/appointments/bookings", "Bookings"],
  ["/analytics", "Analytics"],
  ["/billing", "Billing"],
  ["/plans", "Plans"],
  ["/usage", "Usage"],
  ["/settings", "Settings"],
  ["/settings/organization", "Organization settings"],
  ["/settings/profile", "Profile"],
  ["/settings/security", "Security"],
]);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mobileSidebarOpen = useAppStore((state) => state.mobileSidebarOpen);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const setMobileSidebarOpen = useAppStore((state) => state.setMobileSidebarOpen);
  const setCurrentOrganization = useAuthStore((state) => state.setCurrentOrganization);

  useQuery({
    queryKey: ["organization", "current"],
    queryFn: async () => {
      const organization = await authApi.currentOrganization();
      setCurrentOrganization(organization);
      return organization;
    },
  });

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <Sidebar variant="desktop" pathname={pathname} />

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar variant="mobile" pathname={pathname} />
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-svh transition-[padding] duration-200",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72",
        )}
      >
        <TopNav pathname={pathname} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ pathname, variant }: { pathname: string; variant: "desktop" | "mobile" }) {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useAppStore((state) => state.toggleSidebarCollapsed);
  const setMobileSidebarOpen = useAppStore((state) => state.setMobileSidebarOpen);
  const user = useAuthStore((state) => state.user);
  const organization = useAuthStore((state) => state.currentOrganization);
  const collapsed = variant === "desktop" && sidebarCollapsed;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-200 bg-white transition-[width,transform] duration-200 dark:border-zinc-800 dark:bg-zinc-950",
        variant === "mobile" && "w-80 max-w-[calc(100vw-2rem)] shadow-2xl",
        variant === "desktop" && "hidden lg:flex",
        variant === "desktop" && (collapsed ? "w-20" : "w-72"),
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Link
          href="/dashboard"
          className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}
          title="AI Agent Platform"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">AI Agent Platform</span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                Voice operations
              </span>
            </span>
          ) : null}
        </Link>
        {variant === "mobile" ? (
          <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)}>
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        ) : null}
      </div>

      <div className={cn("border-b border-zinc-200 p-4 dark:border-zinc-800", collapsed && "px-3")}>
        <div
          className={cn(
            "rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40",
            collapsed && "p-2 text-center",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-sm font-semibold text-teal-700 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-teal-300 dark:ring-zinc-800">
              {organization?.name?.[0]?.toUpperCase() ?? "W"}
            </span>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{organization?.name ?? "Workspace"}</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {user?.role ?? "MEMBER"} role
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            {!collapsed ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  closeMobile={() => setMobileSidebarOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {variant === "desktop" ? (
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <Button
            variant="ghost"
            className={cn("w-full justify-start", collapsed && "justify-center px-0")}
            onClick={toggleSidebarCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            )}
            {!collapsed ? <span>Collapse</span> : <span className="sr-only">Expand</span>}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
  closeMobile,
}: {
  item: NavItem & { children?: NavItem[] };
  pathname: string;
  collapsed: boolean;
  closeMobile: () => void;
}) {
  const active = isActive(pathname, item.href, item.children);
  const [open, setOpen] = React.useState(active);
  const Icon = item.icon;
  const hasChildren = Boolean(item.children?.length);

  React.useEffect(() => {
    if (active) {
      setOpen(true);
    }
  }, [active]);

  if (collapsed || !hasChildren) {
    return (
      <Link
        href={item.href}
        title={item.label}
        onClick={closeMobile}
        className={cn(
          "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
          collapsed && "justify-center px-0",
          active && "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed ? item.label : <span className="sr-only">{item.label}</span>}
      </Link>
    );
  }

  return (
    <div>
      <button
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
          active && "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-5 mt-1 space-y-1 border-l border-zinc-200 pl-3 dark:border-zinc-800">
            {item.children?.map((child) => {
              const childActive = pathname === child.href;
              const ChildIcon = child.icon;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={closeMobile}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md px-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
                    childActive &&
                      "bg-teal-50 font-medium text-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopNav({ pathname }: { pathname: string }) {
  const setMobileSidebarOpen = useAppStore((state) => state.setMobileSidebarOpen);
  const toggleSidebarCollapsed = useAppStore((state) => state.toggleSidebarCollapsed);
  const pageTitle = pageTitles.get(pathname) ?? "Workspace";
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Open sidebar</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={toggleSidebarCollapsed}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">{pageTitle}</h1>
          <div className="hidden items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 sm:flex">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.href}>
                {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                <Link
                  className="truncate hover:text-zinc-900 dark:hover:text-zinc-100"
                  href={crumb.href}
                >
                  {crumb.label}
                </Link>
              </React.Fragment>
            ))}
          </div>
        </div>
        <GlobalSearch />
        <NotificationsMenu />
        <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
          <Link href="/settings/organization">
            <Settings className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Settings</span>
          </Link>
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}

function GlobalSearch() {
  return (
    <button className="hidden h-10 w-full max-w-sm items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-left text-sm text-zinc-500 transition-colors hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-900 md:flex">
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">Search workspace</span>
      <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        ⌘K
      </span>
    </button>
  );
}

function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-600" />
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-50 w-80 rounded-md border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <DropdownMenuLabel className="px-2 py-2 text-sm font-semibold">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        <div className="px-3 py-8 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-medium">No notifications</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Alerts for calls, agents, and billing will appear here.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const organization = useAuthStore((state) => state.currentOrganization);
  const { theme, setTheme } = useTheme();
  const initials = `${user?.firstName?.[0] ?? "A"}${user?.lastName?.[0] ?? "P"}`.toUpperCase();
  const fullName = user ? `${user.firstName} ${user.lastName}` : "Platform Admin";
  const nextTheme = theme === "dark" ? "light" : "dark";

  async function handleLogout() {
    await authApi.logout();
    router.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{fullName}</span>
          <ChevronDown className="hidden h-4 w-4 text-zinc-500 sm:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-50 w-72 rounded-md border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <DropdownMenuLabel className="p-3">
          <div className="flex items-start gap-3">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{fullName}</p>
              <p className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {user?.email ?? "Signed in"}
              </p>
              <p className="mt-2 truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {organization?.name ?? "Workspace"} · {user?.role ?? "MEMBER"}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        <DropdownLink href="/settings/profile" icon={UserRound} label="View Profile" />
        <DropdownLink
          href="/settings/organization"
          icon={UsersRound}
          label="Organization Settings"
        />
        <DropdownLink href="/settings/security" icon={Shield} label="Security Settings" />
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-900"
          onSelect={() => setTheme(nextTheme)}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          onSelect={handleLogout}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <DropdownMenuItem asChild>
      <Link
        href={href}
        className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

function isActive(pathname: string, href: string, children?: NavItem[]) {
  if (pathname === href) {
    return true;
  }

  return children?.some((child) => pathname === child.href) ?? false;
}

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [{ href: "/dashboard", label: "Home" }];
  let current = "";

  for (const segment of segments) {
    current += `/${segment}`;
    if (current === "/dashboard") {
      continue;
    }
    crumbs.push({
      href: current,
      label: pageTitles.get(current) ?? titleize(segment),
    });
  }

  return crumbs;
}

function titleize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
