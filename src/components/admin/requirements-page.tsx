"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, Eye, Plus, Search } from "lucide-react";
import { adminFetch, displayDate, exportCsv } from "@/lib/admin/client";
import type { ApiPage, RegistrationRecord, Requirement } from "@/lib/admin/types";
import { Modal, PageFooter, PageHeading, StatusPill, TablePanel, type TableColumn } from "@/components/admin/ui";

export default function RequirementsPage({ adminRole, onToast }: { adminRole: string; onToast: (message: string, error?: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiPage<Requirement>>({ records: [], page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Requirement | null>(null);
  const canManage = ["super_admin", "admin"].includes(adminRole);
  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: "10", q: query.trim(), status });
      adminFetch<ApiPage<Requirement>>(`/api/admin/requirements?${params}`).then((result) => { if (!ignore) { setData(result); setError(""); } }).catch((problem: Error) => { if (!ignore) setError(problem.message); }).finally(() => { if (!ignore) setLoading(false); });
    }, query ? 250 : 0);
    setLoading(true);
    return () => { ignore = true; clearTimeout(timer); };
  }, [page, query, status]);

  const columns: TableColumn<Requirement>[] = [
    { key: "requirement", title: "Requirement", render: (row) => <><span className="primary-cell">{row.item}</span><span className="table-secondary">{row.requirementId} · {row.category}</span></> },
    { key: "ngo", title: "NGO", render: (row) => <><span className="primary-cell">{row.ngoName}</span><span className="table-secondary">{row.ngoRegistrationId}</span></> },
    { key: "required", title: "Required", render: (row) => `${row.requiredQuantity} ${row.unit}` },
    { key: "fulfilled", title: "Fulfilled / remaining", render: (row) => <><span className="primary-cell">{row.fulfilledQuantity} {row.unit}</span><span className="table-secondary">{row.remainingQuantity} {row.unit} remaining</span></> },
    { key: "priority", title: "Priority", render: (row) => <StatusPill status={row.priority} /> },
    { key: "date", title: "Needed by", render: (row) => displayDate(row.requiredBy) },
    { key: "status", title: "Status", render: (row) => <StatusPill status={row.status} /> },
    { key: "view", title: "", render: (row) => <button className="btn btn-sm" onClick={(event) => { event.stopPropagation(); setSelected(row); }}><Eye size={13} /> Details</button> },
  ];

  return <>
    <PageHeading eyebrow="Shared needs" title="NGO requirements" description="Track what partner organizations need, how much has been received, and what still remains. Offered contributions do not count as fulfilled." actions={<>
      <button className="btn" disabled={!data.records.length} onClick={() => exportCsv("ngo-requirements.csv", data.records.map((row) => ({ requirementId: row.requirementId, ngoName: row.ngoName, ngoRegistrationId: row.ngoRegistrationId, item: row.item, category: row.category, required: row.requiredQuantity, fulfilled: row.fulfilledQuantity, remaining: row.remainingQuantity, unit: row.unit, priority: row.priority, requiredBy: row.requiredBy, status: row.status })))}><Download size={14} /> Export page</button>
      {canManage && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Add requirement</button>}
    </>} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="page-toolbar">
      <div className="search-field toolbar-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search NGO, requirement ID, item…" /></div>
      <select className="select-control" style={{ width: "auto", minWidth: 145 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by requirement status"><option value="all">All requirements</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="fulfilled">Fulfilled</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select>
      <span style={{ marginLeft: "auto", color: "#8a857c", fontSize: 10.5 }}>{loading ? "Loading…" : `${data.total.toLocaleString()} requirement${data.total === 1 ? "" : "s"}`}</span>
    </div>
    <TablePanel columns={columns} rows={data.records} loading={loading} emptyTitle="No NGO requirements yet" emptyDescription="Requirements will appear when partner needs are submitted or recorded by an administrator." onRowClick={setSelected} />
    <PageFooter page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
    {createOpen && <RequirementCreate onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); setPage(1); setQuery(""); onToast("NGO requirement saved."); }} />}
    {selected && <RequirementDetails requirement={selected} canManage={canManage} onClose={() => setSelected(null)} onToast={onToast} onUpdated={(updated) => { setSelected(updated); setLoading(true); const params = new URLSearchParams({ page: String(page), limit: "10", q: query.trim(), status }); adminFetch<ApiPage<Requirement>>(`/api/admin/requirements?${params}`).then(setData).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false)); }} />}
  </>;
}

function RequirementCreate({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [ngos, setNgos] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { adminFetch<ApiPage<RegistrationRecord>>("/api/admin/registrations?type=ngo&limit=100&status=approved").then((result) => setNgos(result.records)).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false)); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requiredBy = String(form.get("requiredBy") ?? "");
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/admin/requirements", { method: "POST", body: JSON.stringify({ ngoRegistrationId: form.get("ngoRegistrationId"), item: form.get("item"), category: form.get("category"), requiredQuantity: form.get("requiredQuantity"), unit: form.get("unit"), priority: form.get("priority"), requiredBy: requiredBy ? new Date(requiredBy).toISOString() : null, location: form.get("location") }) });
      onSaved();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The requirement could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title="Add NGO requirement" subtitle="Choose an approved NGO. Received quantities—not open offers—count toward fulfillment." onClose={onClose} wide footer={<><span style={{ color: "#858077", fontSize: 10 }}>Partial fulfillment is tracked automatically.</span><button className="btn btn-primary" type="submit" form="requirement-create" disabled={saving || ngos.length === 0}>{saving ? "Saving…" : "Save requirement"}</button></>}>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {!loading && !ngos.length && <div className="notice" style={{ marginBottom: 13 }}>There are no approved NGOs to select. Verify an NGO registration before adding a requirement.</div>}
    <form id="requirement-create" onSubmit={submit}><div className="form-grid">
      <label className="form-field full"><span className="field-label">Approved NGO *</span><select className="select-control" name="ngoRegistrationId" required disabled={loading || !ngos.length} defaultValue=""><option value="" disabled>{loading ? "Loading organizations…" : "Select an approved NGO"}</option>{ngos.map((ngo) => <option key={ngo.id} value={ngo.registrationId}>{ngo.name} · {ngo.registrationId}</option>)}</select></label>
      <label><span className="field-label">Item / resource *</span><input className="input-control" name="item" required /></label>
      <label><span className="field-label">Category *</span><input className="input-control" name="category" required placeholder="Food, fodder, medicine…" /></label>
      <label><span className="field-label">Required quantity *</span><input className="input-control" type="number" name="requiredQuantity" required step="0.001" min="0.001" /></label>
      <label><span className="field-label">Unit *</span><input className="input-control" name="unit" required placeholder="plates, kg, packs…" /></label>
      <label><span className="field-label">Priority</span><select className="select-control" name="priority"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
      <label><span className="field-label">Required by</span><input className="input-control" name="requiredBy" type="date" /></label>
      <label className="form-field full"><span className="field-label">Delivery location</span><input className="input-control" name="location" /></label>
    </div></form>
  </Modal>;
}

function RequirementDetails({ requirement, canManage, onClose, onToast, onUpdated }: { requirement: Requirement; canManage: boolean; onClose: () => void; onToast: (message: string, error?: boolean) => void; onUpdated: (record: Requirement) => void }) {
  const [status, setStatus] = useState(requirement.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminFetch(`/api/admin/requirements/${requirement.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onToast("Requirement status updated.");
      onUpdated({ ...requirement, status });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The requirement could not be updated.");
    } finally {
      setBusy(false);
    }
  }
  const progress = requirement.requiredQuantity > 0 ? Math.min(100, Math.round(requirement.fulfilledQuantity / requirement.requiredQuantity * 100)) : 0;
  return <Modal title={requirement.item} subtitle={`${requirement.requirementId} · ${requirement.ngoName}`} onClose={onClose} wide>
    <div className="detail-grid"><Detail label="NGO registration ID" value={requirement.ngoRegistrationId} /><Detail label="Category" value={requirement.category} /><Detail label="Priority" value={<StatusPill status={requirement.priority} />} /><Detail label="Required by" value={displayDate(requirement.requiredBy)} /><Detail label="Location" value={requirement.location} /><Detail label="Status" value={<StatusPill status={requirement.status} />} /></div>
    <h3 className="detail-section">Fulfillment</h3>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, fontSize: 11 }}><span><strong>{requirement.fulfilledQuantity} {requirement.unit}</strong> received of {requirement.requiredQuantity} {requirement.unit}</span><strong>{requirement.remainingQuantity} {requirement.unit} remaining</strong></div>
    <div style={{ height: 8, overflow: "hidden", borderRadius: 9, background: "#eee9e1" }}><div style={{ width: `${progress}%`, height: "100%", borderRadius: 9, background: "#38634d", transition: "width .2s" }} /></div>
    <p className="field-hint">Only contribution quantities confirmed as received by the NGO are included. Offered or scheduled contributions do not count.</p>
    {error && <div className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</div>}
    {canManage && <form onSubmit={save} style={{ marginTop: 17, paddingTop: 15, borderTop: "1px solid var(--line)" }}><div className="form-grid"><label><span className="field-label">Requirement status</span><select className="select-control" value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="fulfilled">Fulfilled</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select></label><div style={{ display: "flex", justifyContent: "flex-end", alignItems: "end" }}><button className="btn btn-primary" disabled={busy || status === requirement.status}>{busy ? "Saving…" : "Update status"}</button></div></div></form>}
  </Modal>;
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="detail-item"><div className="detail-label">{label}</div><div className="detail-value">{value || "—"}</div></div>; }
