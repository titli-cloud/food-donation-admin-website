"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Search, SlidersHorizontal, UserRound, Users } from "lucide-react";
import { adminFetch, displayDate, exportCsv, formatRole } from "@/lib/admin/client";
import type { ApiPage, RegistrationRecord } from "@/lib/admin/types";
import { PageFooter, PageHeading, StatusPill, TablePanel, type TableColumn } from "@/components/admin/ui";
import RegistrationCreate from "@/components/admin/registration-create";
import RegistrationProfile from "@/components/admin/registration-profile";

export type RegistrationMode = "volunteer" | "ngo" | "donor" | "shelters" | "verification";
function buildListParams(mode: RegistrationMode, typeFilter: string | undefined, page: number, query: string, status: string, accountStatus: string, roleFilter: string, sort: string) {
  const params = new URLSearchParams({ page: String(page), limit: "10", q: query.trim(), status, accountStatus });
  if (mode !== "verification") params.set("type", typeFilter ?? "");
  else if (roleFilter !== "all") params.set("type", roleFilter);
  params.set("sort", sort === "name" ? "name" : sort === "id" ? "registrationId" : "registeredAt");
  params.set("direction", sort === "oldest" || sort === "name" || sort === "id" ? "asc" : "desc");
  return params.toString();
}

const descriptions: Record<RegistrationMode, { title: string; description: string; eyebrow: string; type?: string }> = {
  volunteer: { title: "Volunteers", eyebrow: "People & partners", description: "Review volunteer registrations, assigned organizations, skills, availability, and participation history.", type: "volunteer" },
  ngo: { title: "NGO management", eyebrow: "Organizations", description: "Review organization profiles, registration details, submitted certificates, and community activity.", type: "ngo" },
  donor: { title: "Donors", eyebrow: "People & partners", description: "Manage individual and business donors, verification records, and their contribution history.", type: "donor" },
  shelters: { title: "Gaushalas & sanctuaries", eyebrow: "Animal welfare", description: "Review the submitted animal-care profile, location, facilities, and support needs of each organization.", type: "shelters" },
  verification: { title: "Verification requests", eyebrow: "Review queue", description: "One queue for pending volunteer, NGO, donor, Gaushala, and sanctuary registrations. Review documents before deciding.", type: undefined },
};

export default function RegistrationList({ mode, adminRole, onToast }: { mode: RegistrationMode; adminRole: string; onToast: (message: string, error?: boolean) => void }) {
  const config = descriptions[mode];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(mode === "verification" ? "needs_review" : "all");
  const [accountStatus, setAccountStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [type, setType] = useState("all");
  const [createRole, setCreateRole] = useState("gaushala");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiPage<RegistrationRecord>>({ records: [], page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const canCreate = ["super_admin", "admin"].includes(adminRole);
  const canExport = ["super_admin", "admin", "verifier"].includes(adminRole);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      const params = buildListParams(mode, config.type, page, query, status, accountStatus, type, sort);
      adminFetch<ApiPage<RegistrationRecord>>(`/api/admin/registrations?${params}`)
        .then((result) => { if (!ignore) { setData(result); setError(""); } })
        .catch((problem: Error) => { if (!ignore) setError(problem.message); })
        .finally(() => { if (!ignore) setLoading(false); });
    }, query ? 250 : 0);
    setLoading(true);
    return () => { ignore = true; clearTimeout(timer); };
  }, [accountStatus, config.type, mode, page, query, sort, status, type]);

  const columns: TableColumn<RegistrationRecord>[] = [
    { key: "applicant", title: mode === "ngo" || mode === "shelters" ? "Organization" : "Applicant", render: (row) => <><span className="primary-cell">{row.name}</span><span className="table-secondary">{row.registrationId}</span></> },
    ...(mode === "verification" || mode === "shelters" ? [{ key: "role", title: "Account type", render: (row: RegistrationRecord) => formatRole(row.role) }] : []),
    { key: "contact", title: "Contact", render: (row) => <>{row.email || "—"}<span className="table-secondary">{row.phone || "No phone provided"}</span></> },
    { key: "location", title: "Location", render: (row) => {
      const city = row.profile?.city;
      const state = row.profile?.state;
      return [city, state].filter(Boolean).join(", ") || "—";
    } },
    { key: "registered", title: "Registered", render: (row) => displayDate(row.registeredAt) },
    { key: "verification", title: "Verification", render: (row) => <StatusPill status={row.verificationStatus} /> },
    { key: "account", title: "Account", render: (row) => <StatusPill status={row.accountStatus} /> },
    { key: "actions", title: "", render: (row) => <button className="btn btn-sm" onClick={(event) => { event.stopPropagation(); setProfileId(row.id); }}>View profile</button> },
  ];

  const exportRows = data.records.map((record) => ({
    name: record.name, registrationId: record.registrationId, accountType: formatRole(record.role), email: record.email,
    phone: record.phone, city: record.profile?.city, state: record.profile?.state, registrationDate: record.registeredAt,
    verificationStatus: record.verificationStatus, accountStatus: record.accountStatus,
  }));
  const exportName = mode === "verification" ? "verification-requests.csv" : `${mode}-registrations.csv`;

  return (
    <>
      <PageHeading eyebrow={config.eyebrow} title={config.title} description={config.description} actions={<>
        {canExport && <button className="btn" disabled={!data.records.length} onClick={() => exportCsv(exportName, exportRows)}><Download size={14} /> Export page</button>}
        {canCreate && mode === "shelters" && <select className="select-control" style={{ width: "auto", minWidth: 145 }} value={createRole} onChange={(event) => setCreateRole(event.target.value)} aria-label="New animal care organization type"><option value="gaushala">Gaushala</option><option value="sanctuary">Sanctuary</option></select>}
        {canCreate && mode !== "verification" && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Add registration</button>}
      </>} />
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="page-toolbar">
        <div className="search-field toolbar-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, registration ID, email…" /></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#8a857c" }}><SlidersHorizontal size={14} /><select className="select-control" style={{ width: "auto", minWidth: 155 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by verification status">
          {mode === "verification" ? <><option value="needs_review">Needs review</option><option value="all">All requests</option><option value="pending">Pending</option><option value="info_requested">Information requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option></> : <><option value="all">All verification</option><option value="pending">Pending</option><option value="info_requested">Information requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option></>}
        </select></div>
        {mode === "verification" && <select className="select-control" style={{ width: "auto", minWidth: 155 }} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} aria-label="Filter by account type"><option value="all">All account types</option><option value="volunteer">Volunteers</option><option value="ngo">NGOs</option><option value="donor">Donors</option><option value="shelters">Gaushalas & sanctuaries</option></select>}
        {mode !== "verification" && <select className="select-control" style={{ width: "auto", minWidth: 132 }} value={accountStatus} onChange={(event) => { setAccountStatus(event.target.value); setPage(1); }} aria-label="Filter by account status"><option value="all">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option></select>}
        <select className="select-control" style={{ width: "auto", minWidth: 128 }} value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Sort registrations"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="id">ID A–Z</option></select>
        <span style={{ marginLeft: "auto", color: "#8a857c", fontSize: 10.5 }}>{loading ? "Loading…" : `${data.total.toLocaleString()} record${data.total === 1 ? "" : "s"}`}</span>
      </div>
      <TablePanel columns={columns} rows={data.records} loading={loading} emptyTitle={query ? "No matching records" : mode === "verification" ? "No verification requests" : "No registrations yet"} emptyDescription={query ? "Try another name, email address, or registration ID." : mode === "verification" ? "There are no records awaiting review for the selected filters." : "No records are currently stored in the connected database. New accounts will appear when the connected application submits them or an admin adds a record."} onRowClick={(row) => setProfileId(row.id)} />
      <PageFooter page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      {createOpen && <RegistrationCreate role={config.type === "shelters" ? createRole : config.type ?? "volunteer"} onClose={() => setCreateOpen(false)} onSaved={(record) => { setCreateOpen(false); setProfileId(record.id); setPage(1); setQuery(""); onToast(`${formatRole(record.role)} registration added and placed in pending review.`); }} />}
      {profileId && <RegistrationProfile id={profileId} adminRole={adminRole} onClose={() => setProfileId(null)} onToast={onToast} onUpdated={() => { setLoading(true); const params = buildListParams(mode, config.type, page, query, status, accountStatus, type, sort); adminFetch<ApiPage<RegistrationRecord>>(`/api/admin/registrations?${params}`).then(setData).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false)); }} />}
    </>
  );
}
