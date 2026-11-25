"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileBarChart, RefreshCw } from "lucide-react";
import { adminFetch, exportCsv } from "@/lib/admin/client";
import type { ReportData } from "@/lib/admin/types";
import { EmptyState, PageHeading } from "@/components/admin/ui";

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function initialFrom() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 11);
  return dateString(date);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => dateString(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    adminFetch<ReportData>(`/api/admin/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((result) => { if (!ignore) { setData(result); setError(""); } })
      .catch((problem: Error) => { if (!ignore) setError(problem.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [from, to]);
  const summary = data?.summary;
  const completedRequirements = summary?.totalRequirements ? Math.round(summary.fulfilledRequirements / summary.totalRequirements * 100) : 0;
  return <>
    <PageHeading eyebrow="Evidence & impact" title="Reports & analytics" description="A practical view of registrations, donation activity, and requirement fulfillment from the connected database." actions={<button className="btn" disabled={!data?.monthly.length} onClick={() => data && exportCsv("seva-monthly-report.csv", data.monthly)}><Download size={14} /> Export CSV</button>} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="page-toolbar" style={{ padding: "13px 15px", border: "1px solid var(--line)", borderRadius: 11, background: "var(--paper)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#77736c", fontSize: 10.5 }}><FileBarChart size={15} /> Reporting period</div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, color: "#77736c", fontSize: 10.5 }}>From <input className="input-control" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} style={{ width: 145 }} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 7, color: "#77736c", fontSize: 10.5 }}>To <input className="input-control" type="date" value={to} min={from} max={dateString(new Date())} onChange={(event) => setTo(event.target.value)} style={{ width: 145 }} /></label>
      <button className="btn btn-sm" onClick={() => { setFrom(initialFrom()); setTo(dateString(new Date())); }}><RefreshCw size={12} /> Reset</button>
      <span style={{ marginLeft: "auto", color: "#8a857c", fontSize: 10 }}>{loading ? "Updating report…" : "Report data is filtered on the server"}</span>
    </div>

    <section className="stat-grid" style={{ marginTop: 14 }}>
      <ReportStat label="Registrations in period" value={summary?.registrations ?? 0} note="Across all account types" />
      <ReportStat label="Food donations" value={summary?.donations ?? 0} note="Submitted in selected dates" tone="green" />
      <ReportStat label="Completed contributions" value={summary?.completedContributions ?? 0} note="Received or fully completed" tone="navy" />
      <ReportStat label="Pending verification" value={summary?.pendingVerifications ?? 0} note="Current outstanding queue" tone="amber" />
    </section>

    <div className="dashboard-grid equal">
      <section className="card">
        <div className="card-header"><div><h2 className="card-title">Monthly registrations</h2><p className="card-subtitle">New records by account type</p></div></div>
        <div className="chart-area">
          {loading ? <div className="loading-row" style={{ height: "100%" }} /> : data?.monthly.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthly} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid stroke="#eee9e1" vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#88837a", fontSize: 9 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#88837a", fontSize: 9 }} /><Tooltip contentStyle={{ border: "1px solid #e8e2d8", borderRadius: 8, fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 9 }} /><Bar dataKey="volunteers" name="Volunteers" stackId="a" fill="#76283a" /><Bar dataKey="ngos" name="NGOs" stackId="a" fill="#263d59" /><Bar dataKey="donors" name="Donors" stackId="a" fill="#70917a" /><Bar dataKey="shelters" name="Care orgs" stackId="a" fill="#bf9553" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer> : <EmptyState title="No registration activity" description="There are no registration records in this date range." />}
        </div>
      </section>
      <section className="card">
        <div className="card-header"><div><h2 className="card-title">Food donations over time</h2><p className="card-subtitle">Number of donations submitted each month</p></div></div>
        <div className="chart-area">
          {loading ? <div className="loading-row" style={{ height: "100%" }} /> : data?.monthly.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthly} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid stroke="#eee9e1" vertical={false} strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#88837a", fontSize: 9 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#88837a", fontSize: 9 }} /><Tooltip contentStyle={{ border: "1px solid #e8e2d8", borderRadius: 8, fontSize: 10 }} /><Line type="monotone" dataKey="donations" name="Food donations" stroke="#76283a" strokeWidth={2} dot={{ r: 3, fill: "#76283a" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer> : <EmptyState title="No donation activity" description="There are no food donations in this date range." />}
        </div>
      </section>
    </div>

    <div className="dashboard-grid equal">
      <section className="card">
        <div className="card-header"><div><h2 className="card-title">Requirement progress</h2><p className="card-subtitle">Requirement records created in this period</p></div><span className="status status-in_progress">{completedRequirements}% fulfilled</span></div>
        <div className="card-body">
          {loading ? <div className="loading-row" /> : <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9, fontSize: 11 }}><span>{summary?.fulfilledRequirements ?? 0} fulfilled</span><strong>{summary?.totalRequirements ?? 0} total requirements</strong></div>
            <div style={{ height: 8, overflow: "hidden", borderRadius: 10, background: "#eee9e1" }}><div style={{ width: `${completedRequirements}%`, height: "100%", borderRadius: 10, background: "#38634d" }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 15, color: "#77736c", fontSize: 10.5 }}><span>{summary?.openRequirements ?? 0} currently open or in progress in the period</span><span>Received-only totals</span></div>
          </>}
        </div>
      </section>
      <section className="card">
        <div className="card-header"><div><h2 className="card-title">Delivered food quantity</h2><p className="card-subtitle">Completed donations, grouped by their submitted unit</p></div></div>
        <div className="card-body no-pad">
          {loading ? <div className="loading-row" /> : data?.rescuedByUnit.length ? <table className="data-table"><thead><tr><th>Unit</th><th>Quantity delivered</th><th>Measure</th></tr></thead><tbody>{data.rescuedByUnit.map((row) => <tr key={row.unit}><td className="primary-cell">{row.unit}</td><td>{row.quantity.toLocaleString()}</td><td>Completed / delivered donations</td></tr>)}</tbody></table> : <EmptyState title="No completed donations" description="Completed food donations will be grouped here without combining different units." />}
        </div>
      </section>
    </div>
    <p className="field-hint" style={{ marginTop: 16 }}>Charts and totals reflect records currently in the shared PostgreSQL database. Donation quantities are kept separate by unit; pending verification is a current outstanding count.</p>
  </>;
}
function ReportStat({ label, value, note, tone }: { label: string; value: number; note: string; tone?: string }) {
  return <div className="stat-card"><div className="stat-top"><div className="stat-label">{label}</div><div className={`stat-icon ${tone ?? ""}`}><FileBarChart size={15} /></div></div><div className="stat-value">{value.toLocaleString()}</div><div className="stat-foot">{note}</div></div>;
}
