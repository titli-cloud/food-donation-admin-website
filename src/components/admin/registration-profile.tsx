"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Clock3, FileImage, FileText, LockKeyhole, Pencil, ShieldAlert, ShieldCheck, Upload, UserRoundCheck, X } from "lucide-react";
import { adminFetch, displayDate, displayDateTime, formatRole } from "@/lib/admin/client";
import type { ActivityRecord, PrivateDocument, RegistrationDetail, RegistrationRecord } from "@/lib/admin/types";
import { EmptyState, Modal, StatusPill } from "@/components/admin/ui";

function labelFor(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
}
function valueFor(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => valueFor(item)).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${labelFor(key)}: ${valueFor(item)}`).join(" · ");
  return String(value);
}

export default function RegistrationProfile({
  id,
  adminRole,
  onClose,
  onToast,
  onUpdated,
}: {
  id: string;
  adminRole: string;
  onClose: () => void;
  onToast: (message: string, error?: boolean) => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<RegistrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"reject" | "request_information" | null>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<PrivateDocument | null>(null);
  const canReview = ["super_admin", "admin", "verifier"].includes(adminRole);
  const canEdit = ["super_admin", "admin"].includes(adminRole);
  const record = detail?.record;

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setDetail(await adminFetch<RegistrationDetail>(`/api/admin/registrations/${id}`));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load this profile.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function performAction(action: string, actionReason = "") {
    if (action === "reject" && !actionReason.trim()) {
      setError("A reason is required before rejecting a registration.");
      return;
    }
    if (action === "request_information" && !actionReason.trim()) {
      setError("Explain what additional information is needed.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await adminFetch<{ record: RegistrationRecord }>(`/api/admin/registrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason: actionReason }),
      });
      setDetail((current) => current ? { ...current, record: result.record } : current);
      setDecision(null);
      setReason("");
      onToast(action === "approve" ? "Registration approved." : action === "reject" ? "Registration rejected with your reason." : action === "request_information" ? "Additional information requested." : action === "suspend" ? "Account suspended." : "Account reactivated.");
      onUpdated();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The requested action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await adminFetch<{ record: RegistrationRecord }>(`/api/admin/registrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update",
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          assignedOrganization: form.get("assignedOrganization"),
          adminRemarks: form.get("adminRemarks"),
        }),
      });
      setDetail((current) => current ? { ...current, record: result.record } : current);
      setEditing(false);
      onToast("Profile details saved.");
      onUpdated();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await adminFetch(`/api/admin/registrations/${id}/documents`, { method: "POST", body: form });
      event.currentTarget.reset();
      onToast("Document stored privately and securely.");
      await reload();
      onUpdated();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The document could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  const profileEntries = Object.entries(record?.profile ?? {}).filter(([, value]) => value !== null && value !== "" && value !== undefined);
  const documentRecords = detail?.documents ?? [];
  const activities = detail?.activities ?? [];

  return (
    <>
      <Modal title={record?.name ?? (loading ? "Loading profile…" : "Registration profile")} subtitle={record ? `${formatRole(record.role)} · ${record.registrationId}` : "Private registration details"} onClose={onClose} wide footer={record ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#7f796f", fontSize: 10 }}><LockKeyhole size={13} /> Authorized admin access only</div>
          <div style={{ display: "flex", gap: 7 }}>
            {canEdit && <button className="btn btn-sm" onClick={() => setEditing((value) => !value)}><Pencil size={13} /> {editing ? "Cancel edit" : "Edit details"}</button>}
            {canEdit && <button className={`btn btn-sm ${record.accountStatus === "suspended" ? "btn-primary" : "btn-danger"}`} disabled={busy} onClick={() => void performAction(record.accountStatus === "suspended" ? "reactivate" : "suspend")}>{record.accountStatus === "suspended" ? "Reactivate" : "Suspend account"}</button>}
          </div>
        </>
      ) : undefined}>
        {loading && <div className="loading-row" style={{ height: 72 }} />}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {record && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginBottom: 18 }}>
              <StatusPill status={record.verificationStatus} /><StatusPill status={record.accountStatus} />
              {record.verifiedAt && <span style={{ color: "#888278", fontSize: 10 }}>Reviewed {displayDate(record.verifiedAt)}</span>}
            </div>

            {editing && canEdit ? (
              <form onSubmit={saveProfile}>
                <h3 className="detail-section" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>Permitted profile updates</h3>
                <div className="form-grid">
                  <label><span className="field-label">Full name</span><input className="input-control" name="name" required defaultValue={record.name} maxLength={160} /></label>
                  <label><span className="field-label">Email address</span><input className="input-control" name="email" type="email" defaultValue={record.email ?? ""} /></label>
                  <label><span className="field-label">Mobile number</span><input className="input-control" name="phone" defaultValue={record.phone ?? ""} /></label>
                  <label><span className="field-label">Assigned organization</span><input className="input-control" name="assignedOrganization" defaultValue={record.assignedOrganization ?? ""} /></label>
                  <label className="form-field full"><span className="field-label">Admin remarks</span><textarea className="textarea-control" name="adminRemarks" defaultValue={record.adminRemarks ?? ""} /></label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 13 }}><button className="btn" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save permitted changes"}</button></div>
              </form>
            ) : (
              <>
                <h3 className="detail-section" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>Registration & contact</h3>
                <div className="detail-grid">
                  <Detail label="Registration ID" value={record.registrationId} />
                  <Detail label="Registered" value={displayDate(record.registeredAt)} />
                  <Detail label="Email address" value={record.email} />
                  <Detail label="Mobile number" value={record.phone} />
                  <Detail label="Assigned organization" value={record.assignedOrganization} />
                  <Detail label="Verified by admin ID" value={record.verifiedBy} />
                  {record.adminRemarks && <Detail label="Admin remarks" value={record.adminRemarks} />}
                  {record.verificationReason && <Detail label="Review note / rejection reason" value={record.verificationReason} />}
                </div>
                {profileEntries.length > 0 && <>
                  <h3 className="detail-section">Submitted profile details</h3>
                  <div className="detail-grid">{profileEntries.map(([key, value]) => <Detail key={key} label={labelFor(key)} value={valueFor(value)} />)}</div>
                </>}
                <h3 className="detail-section">Submitted documents</h3>
                {documentRecords.length ? <div>
                  <div className="notice" style={{ marginBottom: 10 }}><ShieldAlert size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Uploaded documents are private and have not been treated as proof of authenticity. Review them before making a verification decision.</div>
                  {documentRecords.map((document) => <div className="document-row" key={document.id}>
                    <div className="document-icon">{document.contentType.startsWith("image/") ? <FileImage size={17} /> : <FileText size={17} />}</div>
                    <div className="document-info"><div className="document-name">{document.name}</div><div className="document-meta">{document.category} · {(document.byteSize / 1024).toFixed(0)} KB · {displayDate(document.uploadedAt)}</div></div>
                    <button className="btn btn-sm" onClick={() => setPreview(document)}>Preview</button>
                  </div>)}
                </div> : <p className="field-hint">No private documents have been attached to this record.</p>}

                {canReview && <form onSubmit={uploadDocument} style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 8, marginTop: 14, padding: 12, border: "1px solid var(--line)", borderRadius: 9, background: "#fcfaf6" }}>
                  <label style={{ flex: "1 1 150px" }}><span className="field-label">Document category</span><select className="select-control" name="category" defaultValue="identity proof"><option>Identity proof</option><option>Address proof</option><option>Registration certificate</option><option>80G certificate</option><option>12A certificate</option><option>Business registration</option><option>Animal shelter registration</option><option>Other supporting document</option></select></label>
                  <label style={{ flex: "2 1 220px" }}><span className="field-label">Private file · PDF/JPEG/PNG/WebP · max 10 MB</span><input className="input-control" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
                  <button className="btn btn-navy" type="submit" disabled={busy}><Upload size={14} /> Upload privately</button>
                </form>}

                <h3 className="detail-section">Activity & participation history</h3>
                {activities.length ? <div>{activities.map((activity) => <Activity key={activity.id} item={activity} />)}</div> : <p className="field-hint">No activity history is stored for this record yet. Activity will appear when it is supplied by the connected application.</p>}
              </>
            )}

            {canReview && ["pending", "info_requested"].includes(record.verificationStatus) && !editing && (
              <>
                <h3 className="detail-section">Verification decision</h3>
                <div className="notice" style={{ marginBottom: 12 }}>Review submitted details and documents before approval. A file upload by itself does not establish authenticity.</div>
                {decision ? <form onSubmit={(event) => { event.preventDefault(); void performAction(decision, reason); }}>
                  <label><span className="field-label">{decision === "reject" ? "Rejection reason (required)" : "Information requested (required)"}</span><textarea className="textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={decision === "reject" ? "Explain why this registration cannot be approved…" : "Describe the additional documents or information needed…"} required minLength={3} /></label>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 9 }}><button className="btn" type="button" onClick={() => setDecision(null)}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy || reason.trim().length < 3}>{busy ? "Saving…" : "Submit review"}</button></div>
                </form> : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button className="btn btn-primary" disabled={busy} onClick={() => void performAction("approve")}><Check size={14} /> Approve</button>
                  <button className="btn btn-danger" disabled={busy} onClick={() => setDecision("reject")}><X size={14} /> Reject with reason</button>
                  <button className="btn" disabled={busy} onClick={() => setDecision("request_information")}><Clock3 size={14} /> Request information</button>
                </div>}
              </>
            )}
          </>
        )}
      </Modal>

      {preview && <Modal title={preview.name} subtitle={`${preview.category} · private document preview`} onClose={() => setPreview(null)} wide>
        {preview.contentType.startsWith("image/") ? <div style={{ display: "grid", placeItems: "center", minHeight: 280, background: "#f5f2ec" }}><img src={`/api/admin/documents/${preview.id}`} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "68vh", objectFit: "contain" }} /></div> : <iframe title={preview.name} src={`/api/admin/documents/${preview.id}`} style={{ width: "100%", height: "65vh", border: "1px solid var(--line)", borderRadius: 8 }} />}
      </Modal>}
    </>
  );
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return <div className="detail-item"><div className="detail-label">{label}</div><div className="detail-value">{valueFor(value)}</div></div>;
}
function Activity({ item }: { item: ActivityRecord }) {
  return <div className="activity-item"><div className="activity-title">{item.title}</div>{item.description && <div className="detail-value" style={{ marginTop: 4 }}>{item.description}</div>}<div className="activity-date">{formatRole(item.activityType)} · {displayDateTime(item.occurredAt)}{item.relatedId ? ` · ${item.relatedId}` : ""}</div></div>;
}
