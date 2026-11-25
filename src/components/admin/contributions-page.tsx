"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, Eye, Plus, Search } from "lucide-react";
import { adminFetch, displayDateTime, exportCsv } from "@/lib/admin/client";
import type { ApiPage, Contribution, RegistrationRecord, Requirement } from "@/lib/admin/types";
import { Modal, PageFooter, PageHeading, StatusPill, TablePanel, type TableColumn } from "@/components/admin/ui";

export default function ContributionsPage({ adminRole, onToast }: { adminRole: string; onToast: (message: string, error?: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiPage<Contribution>>({ records: [], page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Contribution | null>(null);
  const canManage = ["super_admin", "admin"].includes(adminRole);
  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: "10", q: query.trim(), status });
      adminFetch<ApiPage<Contribution>>(`/api/admin/contributions?${params}`).then((result) => { if (!ignore) { setData(result); setError(""); } }).catch((problem: Error) => { if (!ignore) setError(problem.message); }).finally(() => { if (!ignore) setLoading(false); });
    }, query ? 250 : 0);
    setLoading(true);
    return () => { ignore = true; clearTimeout(timer); };
  }, [page, query, status]);
  const columns: TableColumn<Contribution>[] = [
    { key: "contribution", title: "Contribution", render: (row) => <><span className="primary-cell">{row.item}</span><span className="table-secondary">{row.contributionId} · {row.requirementId}</span></> },
    { key: "donor", title: "Donor", render: (row) => <><span className="primary-cell">{row.donorName}</span><span className="table-secondary">{row.donorRegistrationId ?? "No registration ID"}</span></> },
    { key: "ngo", title: "NGO", render: (row) => <><span className="primary-cell">{row.ngoName}</span><span className="table-secondary">{row.ngoRegistrationId}</span></> },
    { key: "offer", title: "Offered", render: (row) => `${row.quantityOffered} ${row.unit}` },
    { key: "confirmed", title: "Confirmed / received", render: (row) => <><span className="primary-cell">{row.quantityConfirmed} confirmed</span><span className="table-secondary">{row.quantityReceived} {row.unit} received</span></> },
    { key: "date", title: "Offered on", render: (row) => displayDateTime(row.contributedAt) },
    { key: "status", title: "Status", render: (row) => <StatusPill status={row.status} /> },
    { key: "view", title: "", render: (row) => <button className="btn btn-sm" onClick={(event) => { event.stopPropagation(); setSelected(row); }}><Eye size={13} /> Review</button> },
  ];
  return <>
    <PageHeading eyebrow="Shared resources" title="Contributions" description="Follow donor offers through confirmation, delivery, and receipt. Only confirmed quantities received by the NGO count as fulfillment." actions={<>
      <button className="btn" disabled={!data.records.length} onClick={() => exportCsv("contributions.csv", data.records.map((row) => ({ contributionId: row.contributionId, donor: row.donorName, donorRegistrationId: row.donorRegistrationId, ngo: row.ngoName, ngoRegistrationId: row.ngoRegistrationId, requirementId: row.requirementId, item: row.item, quantityOffered: row.quantityOffered, quantityConfirmed: row.quantityConfirmed, quantityReceived: row.quantityReceived, unit: row.unit, status: row.status, date: row.contributedAt })))}><Download size={14} /> Export page</button>
      {canManage && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Record offer</button>}
    </>} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="page-toolbar">
      <div className="search-field toolbar-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search donor, NGO, contribution ID…" /></div>
      <select className="select-control" style={{ width: "auto", minWidth: 150 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by contribution status"><option value="all">All contribution statuses</option>{["offered", "accepted", "scheduled", "in_transit", "received", "completed", "cancelled", "rejected"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      <span style={{ marginLeft: "auto", color: "#8a857c", fontSize: 10.5 }}>{loading ? "Loading…" : `${data.total.toLocaleString()} contribution${data.total === 1 ? "" : "s"}`}</span>
    </div>
    <TablePanel columns={columns} rows={data.records} loading={loading} emptyTitle="No contributions yet" emptyDescription="Contribution offers recorded against a real NGO requirement will be listed here." onRowClick={setSelected} />
    <PageFooter page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
    {createOpen && <ContributionCreate onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); setPage(1); setQuery(""); onToast("Contribution offer recorded; it is not counted as fulfilled."); }} />}
    {selected && <ContributionDetails contribution={selected} canManage={canManage} onClose={() => setSelected(null)} onToast={onToast} onUpdated={(updated) => { setSelected(updated); setLoading(true); const params = new URLSearchParams({ page: String(page), limit: "10", q: query.trim(), status }); adminFetch<ApiPage<Contribution>>(`/api/admin/contributions?${params}`).then(setData).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false)); }} />}
  </>;
}

function ContributionCreate({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [donors, setDonors] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [donor, setDonor] = useState("");
  useEffect(() => {
    Promise.all([
      adminFetch<ApiPage<Requirement>>("/api/admin/requirements?status=open&limit=100"),
      adminFetch<ApiPage<RegistrationRecord>>("/api/admin/registrations?type=donor&status=approved&limit=100"),
    ]).then(([requirementResult, donorResult]) => { setRequirements(requirementResult.records.filter((item) => item.status === "open" || item.status === "in_progress").filter((item) => item.remainingQuantity > 0)); setDonors(donorResult.records); }).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedDonor = donors.find((item) => item.registrationId === donor);
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/admin/contributions", { method: "POST", body: JSON.stringify({ requirementId: form.get("requirementId"), donorRegistrationId: donor || null, donorName: selectedDonor?.name ?? form.get("donorName"), quantityOffered: form.get("quantityOffered"), deliveryPreference: form.get("deliveryPreference") }) });
      onSaved();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The contribution could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title="Record a contribution offer" subtitle="An offer remains pending until the quantity is confirmed and received by the NGO." onClose={onClose} wide footer={<><span style={{ color: "#858077", fontSize: 10 }}>No fulfillment is recorded at this stage.</span><button className="btn btn-primary" type="submit" form="contribution-create" disabled={saving || !requirements.length}>{saving ? "Saving…" : "Record offer"}</button></>}>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {!loading && requirements.length === 0 && <div className="notice" style={{ marginBottom: 12 }}>There are no open requirements with remaining quantity. Add an NGO requirement before recording an offer.</div>}
    <form id="contribution-create" onSubmit={submit}><div className="form-grid">
      <label className="form-field full"><span className="field-label">Open requirement *</span><select className="select-control" name="requirementId" required disabled={loading || !requirements.length} defaultValue=""><option value="" disabled>{loading ? "Loading requirements…" : "Select a requirement"}</option>{requirements.map((item) => <option key={item.id} value={item.requirementId}>{item.ngoName} · {item.item} · {item.remainingQuantity} {item.unit} remaining</option>)}</select></label>
      <label><span className="field-label">Donor account</span><select className="select-control" value={donor} onChange={(event) => setDonor(event.target.value)}><option value="">Other / unregistered donor</option>{donors.map((item) => <option key={item.id} value={item.registrationId}>{item.name} · {item.registrationId}</option>)}</select></label>
      <label><span className="field-label">Donor name *</span><input className="input-control" name="donorName" required disabled={Boolean(donor)} value={donor ? donors.find((item) => item.registrationId === donor)?.name ?? "" : undefined} /></label>
      <label><span className="field-label">Quantity offered *</span><input className="input-control" name="quantityOffered" type="number" min="0.001" step="0.001" required /></label>
      <label><span className="field-label">Pickup / delivery preference</span><select className="select-control" name="deliveryPreference"><option value="">Not specified</option><option value="donor_delivery">Donor will deliver</option><option value="ngo_pickup">NGO pickup</option><option value="volunteer_pickup">Volunteer pickup</option><option value="coordinate">Coordinate later</option></select></label>
    </div></form>
  </Modal>;
}

function ContributionDetails({ contribution, canManage, onClose, onToast, onUpdated }: { contribution: Contribution; canManage: boolean; onClose: () => void; onToast: (message: string, error?: boolean) => void; onUpdated: (record: Contribution) => void }) {
  const [status, setStatus] = useState(contribution.status);
  const [confirmed, setConfirmed] = useState(contribution.quantityConfirmed || contribution.quantityOffered);
  const [received, setReceived] = useState(contribution.quantityReceived || contribution.quantityConfirmed);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available: Record<string, string[]> = {
    offered: ["offered", "accepted", "rejected", "cancelled"],
    accepted: ["accepted", "scheduled", "in_transit", "received", "cancelled"],
    scheduled: ["scheduled", "in_transit", "received", "cancelled"],
    in_transit: ["in_transit", "received"],
    received: ["received", "completed"],
    completed: ["completed"],
    cancelled: ["cancelled"],
    rejected: ["rejected"],
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await adminFetch<{ record: Contribution }>(`/api/admin/contributions/${contribution.id}`, { method: "PATCH", body: JSON.stringify({ status, quantityConfirmed: ["accepted", "scheduled", "in_transit", "received", "completed"].includes(status) ? confirmed : undefined, quantityReceived: ["received", "completed"].includes(status) ? received : undefined, reason }) });
      onToast("Contribution status and quantities updated.");
      onUpdated(result.record);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The contribution could not be updated.");
    } finally {
      setBusy(false);
    }
  }
  return <Modal title={contribution.item} subtitle={`${contribution.contributionId} · ${contribution.requirementId}`} onClose={onClose} wide>
    <div className="detail-grid"><Detail label="Donor" value={`${contribution.donorName}${contribution.donorRegistrationId ? ` · ${contribution.donorRegistrationId}` : ""}`} /><Detail label="NGO" value={`${contribution.ngoName} · ${contribution.ngoRegistrationId}`} /><Detail label="Required item" value={contribution.item} /><Detail label="Offered" value={`${contribution.quantityOffered} ${contribution.unit}`} /><Detail label="Confirmed" value={`${contribution.quantityConfirmed} ${contribution.unit}`} /><Detail label="Received by NGO" value={`${contribution.quantityReceived} ${contribution.unit}`} /><Detail label="Offered on" value={displayDateTime(contribution.contributedAt)} /><Detail label="Delivery preference" value={contribution.deliveryPreference?.replaceAll("_", " ")} /><Detail label="Status" value={<StatusPill status={contribution.status} />} /></div>
    <div className="notice" style={{ marginTop: 16 }}>Only <strong>confirmed quantity received by the NGO</strong> counts toward fulfillment. This page does not count an unconfirmed offer as delivered.</div>
    {error && <div className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</div>}
    {canManage && <><h3 className="detail-section">Review contribution</h3><form onSubmit={save}><div className="form-grid">
      <label><span className="field-label">Contribution status</span><select className="select-control" value={status} onChange={(event) => setStatus(event.target.value)}>{(available[contribution.status] ?? [contribution.status]).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      {["accepted", "scheduled", "in_transit", "received", "completed"].includes(status) && <label><span className="field-label">Quantity confirmed</span><input className="input-control" type="number" min="0.001" max={contribution.quantityOffered} step="0.001" value={confirmed} onChange={(event) => setConfirmed(Number(event.target.value))} /></label>}
      {["received", "completed"].includes(status) && <label><span className="field-label">Cumulative quantity received</span><input className="input-control" type="number" min="0.001" max={confirmed || contribution.quantityOffered} step="0.001" value={received} onChange={(event) => setReceived(Number(event.target.value))} /><span className="field-hint">Enter the total received to date. Partial receipt is supported.</span></label>}
      {["cancelled", "rejected"].includes(status) && <label className="form-field full"><span className="field-label">Reason (required)</span><textarea className="textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
    </div><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 13 }}><button className="btn btn-primary" disabled={busy || status === contribution.status && confirmed === contribution.quantityConfirmed && received === contribution.quantityReceived}>{busy ? "Saving…" : "Save contribution"}</button></div></form></>}
  </Modal>;
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="detail-item"><div className="detail-label">{label}</div><div className="detail-value">{value || "—"}</div></div>; }
