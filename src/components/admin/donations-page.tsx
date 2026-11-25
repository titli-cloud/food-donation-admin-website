"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Download, Eye, Plus, Search, ShieldCheck } from "lucide-react";
import { adminFetch, displayDateTime, exportCsv } from "@/lib/admin/client";
import type { ApiPage, DonationJourneyEvent, FoodDonation } from "@/lib/admin/types";
import { Modal, PageFooter, PageHeading, StatusPill, TablePanel, type TableColumn } from "@/components/admin/ui";

const statuses = ["available", "requested", "accepted", "pickup_scheduled", "picked_up", "delivered", "completed", "cancelled", "rejected", "expired_review"];

export default function DonationsPage({ adminRole, onToast }: { adminRole: string; onToast: (message: string, error?: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiPage<FoodDonation>>({ records: [], page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const canManage = ["super_admin", "admin"].includes(adminRole);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: "10", q: query.trim(), status });
      adminFetch<ApiPage<FoodDonation>>(`/api/admin/donations?${params}`)
        .then((result) => { if (!ignore) { setData(result); setError(""); } })
        .catch((problem: Error) => { if (!ignore) setError(problem.message); })
        .finally(() => { if (!ignore) setLoading(false); });
    }, query ? 250 : 0);
    setLoading(true);
    return () => { ignore = true; clearTimeout(timer); };
  }, [page, query, status]);

  const columns: TableColumn<FoodDonation>[] = [
    { key: "donation", title: "Donation", render: (row) => <><span className="primary-cell">{row.foodItem}</span><span className="table-secondary">{row.donationId} · {row.donorName}</span></> },
    { key: "category", title: "Category", render: (row) => <>{row.foodCategory}<span className="table-secondary">{row.foodType.replaceAll("_", " ")}</span></> },
    { key: "quantity", title: "Quantity", render: (row) => `${row.quantity} ${row.unit}` },
    { key: "safe", title: "Safe until", render: (row) => row.safetyFlag ? <span className="safety-notice"><AlertTriangle size={12} /> Review required</span> : displayDateTime(row.safeUntil) },
    { key: "ngo", title: "Assigned NGO", render: (row) => row.assignedNgoName ?? "Unassigned" },
    { key: "status", title: "Status", render: (row) => <StatusPill status={row.safetyFlag ? "expired_review" : row.status} /> },
    { key: "action", title: "", render: (row) => <button className="btn btn-sm" onClick={(event) => { event.stopPropagation(); setSelected(row.id); }}><Eye size={13} /> Journey</button> },
  ];

  return <>
    <PageHeading eyebrow="Food rescue" title="Food donations" description="Track every donation from submission through pickup and delivery, with clear food-safety review flags." actions={<>
      <button className="btn" disabled={!data.records.length} onClick={() => exportCsv("food-donations.csv", data.records.map((row) => ({ donationId: row.donationId, donor: row.donorName, donorRegistrationId: row.donorRegistrationId, category: row.foodCategory, item: row.foodItem, quantity: row.quantity, unit: row.unit, preparedAt: row.preparedAt, safeUntil: row.safeUntil, status: row.safetyFlag ? "expired_review" : row.status, assignedNGO: row.assignedNgoName })))}><Download size={14} /> Export page</button>
      {canManage && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Record donation</button>}
    </>} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="page-toolbar">
      <div className="search-field toolbar-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search donation ID, donor, food item…" /></div>
      <select className="select-control" style={{ width: "auto", minWidth: 165 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by donation status"><option value="all">All donation statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      <span style={{ marginLeft: "auto", color: "#8a857c", fontSize: 10.5 }}>{loading ? "Loading…" : `${data.total.toLocaleString()} donation${data.total === 1 ? "" : "s"}`}</span>
    </div>
    <TablePanel columns={columns} rows={data.records} loading={loading} emptyTitle={query ? "No matching donations" : "No food donations yet"} emptyDescription={query ? "Try another donation ID, donor name, or food item." : "Food donations will appear when real records are submitted or an administrator records one."} onRowClick={(row) => setSelected(row.id)} />
    <PageFooter page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
    {createOpen && <DonationCreate onClose={() => setCreateOpen(false)} onSaved={(record) => { setCreateOpen(false); setPage(1); setQuery(""); onToast(record.safetyFlag ? "Donation saved and held for food-safety review." : "Food donation recorded."); }} />}
    {selected && <DonationDetails id={selected} canManage={canManage} onClose={() => setSelected(null)} onToast={onToast} onUpdated={() => { setLoading(true); const params = new URLSearchParams({ page: String(page), limit: "10", q: query.trim(), status }); adminFetch<ApiPage<FoodDonation>>(`/api/admin/donations?${params}`).then(setData).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false)); }} />}
  </>;
}

function DonationCreate({ onClose, onSaved }: { onClose: () => void; onSaved: (record: FoodDonation & { safetyFlag?: boolean }) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const toIso = (key: string) => { const value = String(form.get(key) ?? ""); return value ? new Date(value).toISOString() : null; };
    setSaving(true);
    setError("");
    try {
      const result = await adminFetch<{ record: FoodDonation; safetyFlag: boolean }>("/api/admin/donations", {
        method: "POST",
        body: JSON.stringify({
          donorName: form.get("donorName"), donorRegistrationId: form.get("donorRegistrationId"), foodCategory: form.get("foodCategory"), foodItem: form.get("foodItem"),
          quantity: form.get("quantity"), unit: form.get("unit"), preparedAt: toIso("preparedAt"), safeUntil: toIso("safeUntil"), foodType: form.get("foodType"),
          storageConditions: form.get("storageConditions"), safetyNotes: form.get("safetyNotes"), assignedNgoRegistrationId: form.get("assignedNgoRegistrationId"),
          pickupLocation: { address: form.get("pickupAddress"), city: form.get("city"), state: form.get("state"), pinCode: form.get("pinCode") },
        }),
      });
      onSaved({ ...result.record, safetyFlag: result.safetyFlag });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The donation could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title="Record a food donation" subtitle="A donation past its safe-consumption time is held for review, never made available." onClose={onClose} wide footer={<><span style={{ color: "#858077", fontSize: 10 }}>Food safety details are retained in the donation journey.</span><button className="btn btn-primary" type="submit" form="donation-create" disabled={saving}>{saving ? "Saving…" : "Record donation"}</button></>}>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <form id="donation-create" onSubmit={submit}>
      <div className="form-grid">
        <label><span className="field-label">Donor full name *</span><input className="input-control" name="donorName" required /></label>
        <label><span className="field-label">Donor registration ID</span><input className="input-control" name="donorRegistrationId" placeholder="Optional; validated if entered" /></label>
        <label><span className="field-label">Food category *</span><input className="input-control" name="foodCategory" required placeholder="Prepared meal, produce, bakery…" /></label>
        <label><span className="field-label">Food item *</span><input className="input-control" name="foodItem" required /></label>
        <label><span className="field-label">Quantity *</span><input className="input-control" name="quantity" type="number" min="0.001" step="0.001" required /></label>
        <label><span className="field-label">Unit *</span><input className="input-control" name="unit" required placeholder="plates, kg, portions…" /></label>
        <label><span className="field-label">Preparation date & time</span><input className="input-control" name="preparedAt" type="datetime-local" /></label>
        <label><span className="field-label">Last safe-consumption time</span><input className="input-control" name="safeUntil" type="datetime-local" /><span className="field-hint">If already past, this donation is recorded for safety review.</span></label>
        <label><span className="field-label">Food type</span><select className="select-control" name="foodType"><option value="vegetarian">Vegetarian</option><option value="non_vegetarian">Non-vegetarian</option></select></label>
        <label><span className="field-label">Assigned NGO registration ID</span><input className="input-control" name="assignedNgoRegistrationId" placeholder="Optional; validated if entered" /></label>
        <label className="form-field full"><span className="field-label">Storage conditions</span><textarea className="textarea-control" name="storageConditions" placeholder="Packaging, refrigeration, handling notes…" /></label>
        <label><span className="field-label">Pickup address</span><input className="input-control" name="pickupAddress" /></label>
        <label><span className="field-label">City</span><input className="input-control" name="city" /></label>
        <label><span className="field-label">State</span><input className="input-control" name="state" /></label>
        <label><span className="field-label">PIN code</span><input className="input-control" name="pinCode" /></label>
        <label className="form-field full"><span className="field-label">Food safety notes</span><textarea className="textarea-control" name="safetyNotes" /></label>
      </div>
    </form>
  </Modal>;
}

function DonationDetails({ id, canManage, onClose, onToast, onUpdated }: { id: string; canManage: boolean; onClose: () => void; onToast: (message: string, error?: boolean) => void; onUpdated: () => void }) {
  const [record, setRecord] = useState<FoodDonation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { adminFetch<{ record: FoodDonation; safetyFlag: boolean }>(`/api/admin/donations/${id}`).then((data) => setRecord({ ...data.record, safetyFlag: data.safetyFlag })).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false)); }, [id]);
  const unsafe = Boolean(record?.safetyFlag);
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const result = await adminFetch<{ record: FoodDonation; safetyFlag: boolean }>(`/api/admin/donations/${record.id}`, { method: "PATCH", body: JSON.stringify({ status: form.get("status"), reason: form.get("reason"), safetyNotes: form.get("safetyNotes") }) });
      setRecord({ ...result.record, safetyFlag: result.safetyFlag });
      onToast("Donation status and journey updated.");
      onUpdated();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The donation could not be updated.");
    } finally {
      setSaving(false);
    }
  }
  const journey: DonationJourneyEvent[] = record?.journey ?? [];
  const location = record?.pickupLocation ?? {};
  return <Modal title={record?.foodItem ?? (loading ? "Loading donation…" : "Donation details")} subtitle={record ? `${record.donationId} · ${record.donorName}` : "Food donation journey"} onClose={onClose} wide>
    {loading && <div className="loading-row" style={{ height: 65 }} />}{error && <div className="error-banner" role="alert">{error}</div>}
    {record && <>
      {unsafe && <div className="error-banner"><AlertTriangle size={15} /> This donation is past its safe-consumption time or held for review. It cannot be returned to active availability.</div>}
      <div className="detail-grid">
        <Detail label="Donation ID" value={record.donationId} /><Detail label="Donor" value={`${record.donorName}${record.donorRegistrationId ? ` · ${record.donorRegistrationId}` : ""}`} />
        <Detail label="Food category" value={record.foodCategory} /><Detail label="Quantity" value={`${record.quantity} ${record.unit}`} />
        <Detail label="Food type" value={record.foodType.replaceAll("_", " ")} /><Detail label="Status" value={<StatusPill status={unsafe ? "expired_review" : record.status} />} />
        <Detail label="Prepared" value={displayDateTime(record.preparedAt)} /><Detail label="Safe until" value={record.safeUntil ? displayDateTime(record.safeUntil) : "Not specified"} />
        <Detail label="Storage conditions" value={record.storageConditions} /><Detail label="Assigned NGO" value={record.assignedNgoName ? `${record.assignedNgoName}${record.assignedNgoRegistrationId ? ` · ${record.assignedNgoRegistrationId}` : ""}` : "Unassigned"} />
        <Detail label="Pickup location" value={[location.address, location.city, location.state, location.pinCode].filter(Boolean).join(", ")} /><Detail label="Food safety notes" value={record.safetyNotes} />
      </div>
      <h3 className="detail-section">Donation journey</h3>
      {journey.length ? journey.map((item, index) => <div className="activity-item" key={`${item.changedAt}-${index}`}><div className="activity-title">{item.status.replaceAll("_", " ")}</div>{item.note && <div className="detail-value" style={{ marginTop: 3 }}>{item.note}</div>}<div className="activity-date">{displayDateTime(item.changedAt)}{item.changedBy ? ` · ${item.changedBy}` : ""}</div></div>) : <div className="field-hint">No journey updates yet.</div>}
      {canManage && <><h3 className="detail-section">Update donation status</h3><form onSubmit={update}>
        <div className="form-grid">
          <label><span className="field-label">Next status</span><select className="select-control" name="status" defaultValue={unsafe ? "expired_review" : record.status}>{statuses.filter((value) => !unsafe || !["available", "requested", "accepted", "pickup_scheduled", "picked_up", "delivered"].includes(value)).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <label><span className="field-label">Safety notes</span><input className="input-control" name="safetyNotes" defaultValue={record.safetyNotes ?? ""} /></label>
          <label className="form-field full"><span className="field-label">Reason / journey note (required to cancel or reject)</span><textarea className="textarea-control" name="reason" /></label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save status"}</button></div>
      </form></>}
      <div className="notice" style={{ marginTop: 16 }}><ShieldCheck size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> An unexpired date is not a substitute for safe handling. Review the storage and preparation information before coordinating pickup.</div>
    </>}
  </Modal>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="detail-item"><div className="detail-label">{label}</div><div className="detail-value">{value || "—"}</div></div>;
}
