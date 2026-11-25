"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Bell, Building2, ChartNoAxesColumnIncreasing, Clock3, HeartHandshake, HandCoins, PackageCheck, Users, Warehouse } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminFetch, displayDate, displayDateTime, formatRole } from "@/lib/admin/client";
import type { DashboardData, FoodDonation, RegistrationRecord } from "@/lib/admin/types";
import { EmptyState, PageHeading, StatusPill, TablePanel, type TableColumn } from "@/components/admin/ui";

function StatCard({ label, value, note, icon, tone, href }: { label: string; value: number; note: string; icon: React.ReactNode; tone?: string; href: string }) {
  return (
    <Link className="stat-card" href={href}>
      <div className="stat-top"><div className="stat-label">{label}</div><div className={`stat-icon ${tone ?? ""}`}>{icon}</div></div>
      <div className="stat-value">{value.toLocaleString()}</div><div className="stat-foot">{note}</div>
    </Link>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<DashboardData>("/api/admin/dashboard").then(setData).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    const totals = new Map((data?.donationsThisWeek ?? []).map((item) => [item.day, item.total]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { day: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date), donations: totals.get(key) ?? 0 };
    });
  }, [data]);

  const registrationColumns: TableColumn<RegistrationRecord>[] = [
    { key: "name", title: "Applicant", render: (row) => <><span className="primary-cell">{row.name}</span><span className="table-secondary">{row.registrationId}</span></> },
    { key: "role", title: "Account type", render: (row) => formatRole(row.role) },
    { key: "date", title: "Registered", render: (row) => displayDate(row.registeredAt) },
    { key: "status", title: "Verification", render: (row) => <StatusPill status={row.verificationStatus} /> },
  ];
  const donationColumns: TableColumn<FoodDonation>[] = [
    { key: "item", title: "Food donation", render: (row) => <><span className="primary-cell">{row.foodItem}</span><span className="table-secondary">{row.donationId} · {row.donorName}</span></> },
    { key: "quantity", title: "Quantity", render: (row) => `${row.quantity} ${row.unit}` },
    { key: "status", title: "Status", render: (row) => <StatusPill status={row.safetyFlag ? "expired_review" : row.status} /> },
    { key: "date", title: "Submitted", render: (row) => displayDateTime(row.createdAt) },
  ];

  const totals = data?.totals;
  return (
    <>
      <PageHeading eyebrow="Overview" title="Good morning, admin" description="A clear view of the people, food, and care needs moving through your community." actions={<Link className="btn btn-soft" href="/verifications"><Clock3 size={14} /> Review queue{totals?.pendingVerifications ? ` · ${totals.pendingVerifications}` : ""}</Link>} />
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="stat-grid" aria-label="Community overview">
        <StatCard label="Registered volunteers" value={totals?.volunteers ?? 0} note="People ready to lend a hand" icon={<Users size={16} />} href="/volunteers" />
        <StatCard label="Registered NGOs" value={totals?.ngos ?? 0} note="Community organizations" icon={<Building2 size={16} />} tone="navy" href="/ngos" />
        <StatCard label="Registered donors" value={totals?.donors ?? 0} note="Food and resource partners" icon={<HandCoins size={16} />} tone="green" href="/donors" />
        <StatCard label="Care organizations" value={totals?.shelters ?? 0} note="Gaushalas and sanctuaries" icon={<Warehouse size={16} />} tone="amber" href="/shelters" />
        <StatCard label="Pending verification" value={totals?.pendingVerifications ?? 0} note="Needs a document review" icon={<Clock3 size={16} />} tone="amber" href="/verifications" />
        <StatCard label="Active food donations" value={totals?.activeDonations ?? 0} note="Unsafe food is held for review" icon={<PackageCheck size={16} />} tone="green" href="/donations" />
        <StatCard label="Open requirements" value={totals?.openRequirements ?? 0} note="Needs shared by NGOs" icon={<HeartHandshake size={16} />} tone="navy" href="/requirements" />
        <StatCard label="Pending contributions" value={totals?.pendingContributions ?? 0} note="Offers awaiting confirmation" icon={<Activity size={16} />} href="/contributions" />
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header"><div><h2 className="card-title">Food donation activity</h2><p className="card-subtitle">New donations recorded over the last seven days</p></div><span className="chart-caption"><span className="chart-dot" /> Donations</span></div>
          <div className="chart-area">
            {loading ? <div className="loading-row" style={{ height: "100%" }} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#eee9e1" vertical={false} strokeDasharray="3 4" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#88837a", fontSize: 10 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#88837a", fontSize: 10 }} />
                  <Tooltip cursor={{ fill: "#f7f4ee" }} contentStyle={{ border: "1px solid #e8e2d8", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="donations" fill="#76283a" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card-header"><div><h2 className="card-title">Needs your attention</h2><p className="card-subtitle">Requests waiting for an administrator</p></div><Link className="btn-link" href="/verifications">View queue <ArrowRight size={13} /></Link></div>
          <div className="card-body">
            {!data?.pendingApprovals.length && !loading ? <EmptyState title="All caught up" description="There are no registrations awaiting review." /> : (
              <div style={{ display: "grid", gap: 2 }}>
                {(data?.pendingApprovals ?? []).map((record) => <button key={record.id} className="notification-item" onClick={() => router.push(`/verifications?record=${record.id}`)} style={{ width: "100%", border: 0, background: "transparent", textAlign: "left" }}>
                  <span className="notification-mark" /><span style={{ flex: 1 }}><span className="notification-title">{record.name}</span><span className="notification-message">{formatRole(record.role)} · {record.registrationId}</span><span className="notification-date">Submitted {displayDate(record.registeredAt)}</span></span><StatusPill status={record.verificationStatus} />
                </button>)}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dashboard-grid equal">
        <section className="card">
          <div className="card-header"><div><h2 className="card-title">Recent registrations</h2><p className="card-subtitle">Latest accounts recorded in the database</p></div><Link className="btn-link" href="/volunteers">Browse records <ArrowRight size={13} /></Link></div>
          <div className="card-body no-pad">
            {loading ? <div className="loading-row" /> : <TablePanel columns={registrationColumns} rows={data?.recentRegistrations ?? []} loading={false} emptyTitle="No registrations yet" emptyDescription="New registrations will appear when records are created through the connected application or admin register." />}
          </div>
        </section>
        <section className="card">
          <div className="card-header"><div><h2 className="card-title">Recent food donations</h2><p className="card-subtitle">Latest food activity and safety status</p></div><Link className="btn-link" href="/donations">View donations <ArrowRight size={13} /></Link></div>
          <div className="card-body no-pad">
            {loading ? <div className="loading-row" /> : <TablePanel columns={donationColumns} rows={data?.recentDonations ?? []} loading={false} emptyTitle="No food donations yet" emptyDescription="Donations recorded in the database will be listed here." />}
          </div>
        </section>
      </div>
      <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "17px 2px 0", color: "#8e897f", fontSize: 10 }}><ChartNoAxesColumnIncreasing size={13} /> All figures are calculated from records currently stored in this database.</p>
    </>
  );
}
