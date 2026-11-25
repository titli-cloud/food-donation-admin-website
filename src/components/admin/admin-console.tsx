"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, Building2, ChartNoAxesColumnIncreasing, ChevronDown, HandCoins, HeartHandshake, Home, LogOut, Menu, PackageCheck, Search, Settings2, ShieldCheck, UserRoundCheck, Users, Warehouse, X } from "lucide-react";
import { adminFetch, formatRole } from "@/lib/admin/client";
import { sectionPermissions } from "@/lib/admin/permissions";
import type { AdminPrincipal, AdminNotification, Contribution, FoodDonation, RegistrationRecord, Requirement } from "@/lib/admin/types";
import Dashboard from "@/components/admin/dashboard";
import RegistrationList, { type RegistrationMode } from "@/components/admin/registration-list";
import DonationsPage from "@/components/admin/donations-page";
import RequirementsPage from "@/components/admin/requirements-page";
import ContributionsPage from "@/components/admin/contributions-page";
import ReportsPage from "@/components/admin/reports-page";
import NotificationsPage from "@/components/admin/notifications-page";
import SettingsPage from "@/components/admin/settings-page";

const navItems = [
  { section: "dashboard", label: "Dashboard", href: "/", icon: Home, group: "Overview" },
  { section: "volunteers", label: "Volunteers", href: "/volunteers", icon: Users, group: "Community" },
  { section: "ngos", label: "NGOs", href: "/ngos", icon: Building2, group: "Community" },
  { section: "donors", label: "Donors", href: "/donors", icon: HandCoins, group: "Community" },
  { section: "shelters", label: "Gaushalas & sanctuaries", href: "/shelters", icon: Warehouse, group: "Community" },
  { section: "donations", label: "Food donations", href: "/donations", icon: PackageCheck, group: "Operations" },
  { section: "requirements", label: "NGO requirements", href: "/requirements", icon: HeartHandshake, group: "Operations" },
  { section: "contributions", label: "Contributions", href: "/contributions", icon: Activity, group: "Operations" },
  { section: "verifications", label: "Verification requests", href: "/verifications", icon: UserRoundCheck, group: "Operations" },
  { section: "reports", label: "Reports & analytics", href: "/reports", icon: ChartNoAxesColumnIncreasing, group: "Workspace" },
  { section: "notifications", label: "Notifications", href: "/notifications", icon: Bell, group: "Workspace" },
  { section: "settings", label: "Admin settings", href: "/settings", icon: Settings2, group: "Workspace" },
] as const;
const pageTitles: Record<string, string> = Object.fromEntries(navItems.map((item) => [item.section, item.label]));

type SearchResults = {
  registrations: Pick<RegistrationRecord, "id" | "registrationId" | "role" | "name" | "verificationStatus">[];
  donations: Pick<FoodDonation, "id" | "donationId" | "donorName" | "foodItem" | "status">[];
  requirements: Pick<Requirement, "id" | "requirementId" | "ngoName" | "item" | "status">[];
  contributions?: Pick<Contribution, "id" | "contributionId" | "donorName" | "ngoName" | "status">[];
};

export default function AdminConsole({ section, admin }: { section: string; admin: AdminPrincipal }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const visibleNav = useMemo(() => navItems.filter((item) => sectionPermissions[item.section]?.includes(admin.role)), [admin.role]);
  const visibleGroups = Array.from(new Set(visibleNav.map((item) => item.group)));

  useEffect(() => {
    let active = true;
    adminFetch<{ unreadCount: number }>("/api/admin/notifications?page=1&limit=1").then((data) => { if (active) setUnread(data.unreadCount); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let active = true;
    if (search.trim().length < 2) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      adminFetch<SearchResults>(`/api/admin/search?q=${encodeURIComponent(search.trim())}`).then((result) => { if (active) setSearchResults(result); }).catch(() => { if (active) setSearchResults(null); }).finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  function notify(message: string, error = false) {
    setToast({ message, error });
    if (!error) adminFetch<{ unreadCount: number }>("/api/admin/notifications?page=1&limit=1").then((data) => setUnread(data.unreadCount)).catch(() => undefined);
  }
  async function logout() {
    try { await adminFetch("/api/admin/logout", { method: "POST" }); }
    finally { router.replace("/login"); router.refresh(); }
  }
  function openSearchResult(path: string) {
    setSearchOpen(false);
    setSearch("");
    router.push(path);
  }
  const groupedResults = Boolean(searchResults && (searchResults.registrations.length || searchResults.donations.length || searchResults.requirements.length || searchResults.contributions?.length));

  return (
    <div className="admin-layout">
      <div className={`mobile-overlay${mobileOpen ? " open" : ""}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <aside className={`admin-sidebar${mobileOpen ? " open" : ""}`}>
        <Link className="brand" href="/" aria-label="AI Food Bridge dashboard"><div className="brand-mark"><HeartHandshake size={20} /></div><div><div className="brand-name">AI Food Bridge</div><div className="brand-caption">Care, shared thoughtfully</div></div></Link>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {visibleGroups.map((group) => <div key={group}><div className="sidebar-label">{group}</div>{visibleNav.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon;
            const active = section === item.section || section === "verifications" && item.section === "verifications";
            return <Link key={item.section} href={item.href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.8} /><span>{item.label}</span>{item.section === "notifications" && unread > 0 && <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>}</Link>;
          })}</div>)}
        </nav>
        <div className="sidebar-bottom">
          <Link className="sidebar-profile" href="/settings"><span className="avatar">{initials(admin.name)}</span><span className="profile-copy"><span className="profile-name">{admin.name}</span><span className="profile-role">{formatRole(admin.role)}</span></span><ChevronDown size={14} color="#888278" /></Link>
          <button className="nav-link" style={{ width: "100%", border: 0, background: "transparent" }} onClick={() => void logout()}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <button className="icon-button menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="topbar-title">{pageTitles[section] ?? "Admin workspace"}</div>
          <div className="topbar-search" onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 160)}>
            <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setSearch(""); setSearchOpen(false); } }} placeholder="Search records…" aria-label="Search records" /><span className="search-shortcut">⌘ K</span></label>
            {searchOpen && search.trim().length >= 2 && <div className="search-popover">
              {searching ? <div className="search-group-label">Searching records…</div> : !groupedResults ? <div className="search-group-label">No records match this search.</div> : <>
                {searchResults?.registrations.length ? <><div className="search-group-label">Registrations</div>{searchResults.registrations.map((item) => <button className="search-result" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(`${registrationPath(item.role)}?record=${item.id}`)}><span><strong>{item.name}</strong><span>{formatRole(item.role)} · {item.registrationId}</span></span><span className={`status status-${item.verificationStatus}`}>{item.verificationStatus.replaceAll("_", " ")}</span></button>)}</> : null}
                {searchResults?.donations.length ? <><div className="search-group-label">Food donations</div>{searchResults.donations.map((item) => <button className="search-result" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(`/donations?record=${item.id}`)}><span><strong>{item.foodItem}</strong><span>{item.donationId} · {item.donorName}</span></span></button>)}</> : null}
                {searchResults?.requirements.length ? <><div className="search-group-label">NGO requirements</div>{searchResults.requirements.map((item) => <button className="search-result" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(`/requirements?record=${item.id}`)}><span><strong>{item.item}</strong><span>{item.requirementId} · {item.ngoName}</span></span></button>)}</> : null}
                {searchResults?.contributions?.length ? <><div className="search-group-label">Contributions</div>{searchResults.contributions.map((item) => <button className="search-result" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(`/contributions?record=${item.id}`)}><span><strong>{item.contributionId}</strong><span>{item.donorName} · {item.ngoName}</span></span></button>)}</> : null}
              </>}
            </div>}
          </div>
          <div className="topbar-actions">
            <Link href="/notifications" className="icon-button" aria-label={`Notifications, ${unread} unread`}><Bell size={17} />{unread > 0 && <span className="notification-dot" />}</Link>
            <Link href="/settings" className="avatar" aria-label="Administrator settings">{initials(admin.name)}</Link>
          </div>
        </header>
        <main className="page-wrap">
          {process.env.NEXT_PUBLIC_ADMIN_DEMO_MODE === "true" && <div className="notice" style={{ marginBottom: 14 }}>Frontend preview mode: screens use empty sample data. Connect a database to enable saving changes.</div>}
          <SectionContent section={section} admin={admin} onToast={notify} onRead={() => adminFetch<{ unreadCount: number }>("/api/admin/notifications?page=1&limit=1").then((data) => setUnread(data.unreadCount)).catch(() => undefined)} />
        </main>
      </div>
      {toast && <div className={`toast${toast.error ? " error" : ""}`} role="status"><ShieldCheck size={15} />{toast.message}</div>}
    </div>
  );
}

function SectionContent({ section, admin, onToast, onRead }: { section: string; admin: AdminPrincipal; onToast: (message: string, error?: boolean) => void; onRead: () => void }) {
  if (section === "dashboard") return <Dashboard />;
  if (section === "volunteers") return <RegistrationList mode="volunteer" adminRole={admin.role} onToast={onToast} />;
  if (section === "ngos") return <RegistrationList mode="ngo" adminRole={admin.role} onToast={onToast} />;
  if (section === "donors") return <RegistrationList mode="donor" adminRole={admin.role} onToast={onToast} />;
  if (section === "shelters") return <RegistrationList mode="shelters" adminRole={admin.role} onToast={onToast} />;
  if (section === "verifications") return <RegistrationList mode="verification" adminRole={admin.role} onToast={onToast} />;
  if (section === "donations") return <DonationsPage adminRole={admin.role} onToast={onToast} />;
  if (section === "requirements") return <RequirementsPage adminRole={admin.role} onToast={onToast} />;
  if (section === "contributions") return <ContributionsPage adminRole={admin.role} onToast={onToast} />;
  if (section === "reports") return <ReportsPage />;
  if (section === "notifications") return <NotificationsPage onRead={onRead} />;
  if (section === "settings") return <SettingsPage admin={admin} onToast={onToast} />;
  return <></>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AD";
}
function registrationPath(role: string) {
  const paths: Record<string, string> = { volunteer: "/volunteers", ngo: "/ngos", donor: "/donors", gaushala: "/shelters", sanctuary: "/shelters" };
  return paths[role] ?? "/verifications";
}
