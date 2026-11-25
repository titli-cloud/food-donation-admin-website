"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Activity, KeyRound, LockKeyhole, Plus, Shield, ShieldCheck, UserCog, Users } from "lucide-react";
import { adminFetch, displayDate, displayDateTime } from "@/lib/admin/client";
import type { AdminPrincipal, AdminUser, AuditRecord } from "@/lib/admin/types";
import { Modal, PageHeading, StatusPill } from "@/components/admin/ui";

const roles = ["super_admin", "admin", "verifier", "analyst"];
const roleDescriptions: Record<string, string> = {
  super_admin: "Full access, admin provisioning, and audit settings.",
  admin: "Manage registrations, donations, requirements, and contributions.",
  verifier: "Review registrations and manage verification documents.",
  analyst: "Read operational summaries and reports; no personal registration details.",
};

export default function SettingsPage({ admin, onToast }: { admin: AdminPrincipal; onToast: (message: string, error?: boolean) => void }) {
  const [account, setAccount] = useState<AdminUser>({ ...admin });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const isSuper = admin.role === "super_admin";
  useEffect(() => {
    const requests: Promise<unknown>[] = [adminFetch<{ account: AdminUser }>("/api/admin/settings").then((result) => setAccount(result.account))];
    if (isSuper) {
      requests.push(adminFetch<{ users: AdminUser[] }>("/api/admin/admins").then((result) => setUsers(result.users)));
      requests.push(adminFetch<{ records: AuditRecord[] }>("/api/admin/audit?page=1&limit=15").then((result) => setAudit(result.records)));
    }
    Promise.all(requests).catch((problem: Error) => setError(problem.message)).finally(() => setLoading(false));
  }, [isSuper]);

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (newPassword && newPassword !== confirm) { setError("The new passwords do not match."); return; }
    const body: Record<string, unknown> = { name: form.get("name"), email: form.get("email") };
    if (newPassword) { body.currentPassword = form.get("currentPassword"); body.newPassword = newPassword; }
    setSaving(true);
    setError("");
    try {
      const result = await adminFetch<{ account: AdminUser }>("/api/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
      setAccount(result.account);
      event.currentTarget.reset();
      onToast("Administrator account updated.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Account settings could not be saved."); }
    finally { setSaving(false); }
  }

  async function updateUser(user: AdminUser, changes: { role?: string; active?: boolean }) {
    setError("");
    try {
      const result = await adminFetch<{ user: AdminUser }>(`/api/admin/admins/${user.id}`, { method: "PATCH", body: JSON.stringify(changes) });
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item));
      onToast("Administrator access updated.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Administrator access could not be updated."); }
  }

  return <>
    <PageHeading eyebrow="Workspace" title="Admin settings" description="Update your own security details, review administrator access, and inspect the audit trail." />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="dashboard-grid equal" style={{ alignItems: "start" }}>
      <section className="card">
        <div className="card-header"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="stat-icon navy"><UserCog size={16} /></div><div><h2 className="card-title">Your administrator account</h2><p className="card-subtitle">Personal access and sign-in security</p></div></div><StatusPill status={account.role} /></div>
        <div className="card-body">
          {loading ? <div className="loading-row" /> : <form onSubmit={saveAccount}>
            <div className="form-grid">
              <label><span className="field-label">Full name</span><input className="input-control" name="name" required maxLength={120} defaultValue={account.name} /></label>
              <label><span className="field-label">Email address</span><input className="input-control" type="email" name="email" required defaultValue={account.email} /></label>
              <div className="form-field full detail-section" style={{ margin: "5px 0 0", paddingTop: 14 }}>Change password <span className="field-hint">Leave blank to keep your current password. Changing it signs out other sessions.</span></div>
              <label className="form-field full"><span className="field-label">Current password</span><input className="input-control" name="currentPassword" type="password" autoComplete="current-password" /></label>
              <label><span className="field-label">New password</span><input className="input-control" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} /></label>
              <label><span className="field-label">Confirm new password</span><input className="input-control" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} /></label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, marginTop: 17 }}><div className="field-hint" style={{ display: "flex", alignItems: "center", gap: 5 }}><LockKeyhole size={12} /> Signed, HTTP-only session · 8 hour expiry</div><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save account"}</button></div>
          </form>}
        </div>
      </section>
      <section className="card">
        <div className="card-header"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="stat-icon"><ShieldCheck size={16} /></div><div><h2 className="card-title">Access & privacy</h2><p className="card-subtitle">Role-based access is enforced by the server</p></div></div></div>
        <div className="card-body">
          {roles.map((role) => <div key={role} style={{ display: "flex", gap: 11, padding: "10px 0", borderBottom: "1px solid #eee9e1" }}><Shield size={15} style={{ marginTop: 2, color: role === "super_admin" ? "var(--maroon)" : "var(--navy)" }} /><div><div style={{ color: "#393630", fontSize: 11, fontWeight: 700 }}>{role.replaceAll("_", " ")}</div><div style={{ marginTop: 4, color: "#7e796f", fontSize: 10, lineHeight: 1.5 }}>{roleDescriptions[role]}</div></div></div>)}
          <div className="notice" style={{ marginTop: 13 }}>Sensitive identity documents are only served through authenticated document routes. Uploaded files are not treated as evidence of authenticity.</div>
        </div>
      </section>
    </div>

    {isSuper && <section className="card" style={{ marginTop: 16 }}>
      <div className="card-header"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="stat-icon amber"><Users size={16} /></div><div><h2 className="card-title">Administrator access</h2><p className="card-subtitle">Provision, scope, and deactivate admin accounts</p></div></div><button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={14} /> Add administrator</button></div>
      {loading ? <div className="loading-row" /> : users.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Administrator</th><th>Role</th><th>Account status</th><th>Added</th><th>Access</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}>
        <td><span className="primary-cell">{user.name}</span><span className="table-secondary">{user.email}</span></td>
        <td><select className="select-control" style={{ width: "auto", minWidth: 130 }} value={user.role} disabled={user.id === admin.id} onChange={(event) => void updateUser(user, { role: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></td>
        <td><StatusPill status={user.active ? "active" : "suspended"} /></td>
        <td>{displayDate(user.createdAt)}</td>
        <td><button className={`btn btn-sm ${user.active ? "btn-danger" : "btn-soft"}`} disabled={user.id === admin.id} onClick={() => void updateUser(user, { active: !user.active })}>{user.id === admin.id ? "Current account" : user.active ? "Deactivate" : "Reactivate"}</button></td>
      </tr>)}</tbody></table></div> : <div className="card-body"><p className="field-hint">No administrator accounts are available.</p></div>}
    </section>}

    {isSuper && <section className="card" style={{ marginTop: 16 }}>
      <div className="card-header"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="stat-icon green"><Activity size={16} /></div><div><h2 className="card-title">Recent audit history</h2><p className="card-subtitle">Important administrator actions, recorded with identity and time</p></div></div></div>
      {loading ? <div className="loading-row" /> : audit.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Administrator</th><th>Action</th><th>Record</th><th>Time</th></tr></thead><tbody>{audit.map((row) => <tr key={row.id}><td className="primary-cell">{row.adminName}</td><td>{row.action.replaceAll("_", " ")}</td><td>{row.entityType}{row.entityId ? <span className="table-secondary">{row.entityId}</span> : ""}</td><td>{displayDateTime(row.occurredAt)}</td></tr>)}</tbody></table></div> : <div className="card-body"><div className="field-hint">No audit activity has been recorded yet.</div></div>}
    </section>}

    {!isSuper && <div className="notice" style={{ marginTop: 16 }}>Administrator provisioning and audit history are available to the super administrator only.</div>}
    {addOpen && <AddAdmin onClose={() => setAddOpen(false)} onSaved={(user) => { setUsers((current) => [user, ...current]); setAddOpen(false); onToast("Administrator account created with the selected role."); }} />}
  </>;
}

function AddAdmin({ onClose, onSaved }: { onClose: () => void; onSaved: (user: AdminUser) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setSaving(true);
    setError("");
    try {
      const result = await adminFetch<{ user: AdminUser }>("/api/admin/admins", { method: "POST", body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password, role: form.get("role") }) });
      onSaved(result.user);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Administrator could not be created."); }
    finally { setSaving(false); }
  }
  return <Modal title="Add administrator" subtitle="Create a separate account with only the role permissions it needs." onClose={onClose} footer={<><span className="field-hint">Password is hashed before storage.</span><button className="btn btn-primary" type="submit" form="admin-create" disabled={saving}>{saving ? "Creating…" : "Create account"}</button></>}>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <form id="admin-create" onSubmit={submit}><div className="form-grid">
      <label className="form-field full"><span className="field-label">Full name *</span><input className="input-control" name="name" required maxLength={120} /></label>
      <label className="form-field full"><span className="field-label">Email address *</span><input className="input-control" type="email" name="email" required /></label>
      <label className="form-field full"><span className="field-label">Role *</span><select className="select-control" name="role"><option value="admin">Admin</option><option value="verifier">Verifier</option><option value="analyst">Analyst</option><option value="super_admin">Super admin</option></select><span className="field-hint">Grant the minimum access required for this person’s work.</span></label>
      <label><span className="field-label">Initial password *</span><input className="input-control" name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" /></label>
      <label><span className="field-label">Confirm password *</span><input className="input-control" name="confirm" type="password" required minLength={12} maxLength={256} autoComplete="new-password" /></label>
    </div></form>
  </Modal>;
}
