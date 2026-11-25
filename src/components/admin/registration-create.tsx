"use client";

import { useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/admin/client";
import type { RegistrationRecord } from "@/lib/admin/types";
import { Modal } from "@/components/admin/ui";

type Field = { name: string; label: string; type?: "text" | "email" | "date" | "number" | "textarea"; hint?: string };
const fields: Record<string, Field[]> = {
  volunteer: [
    { name: "dateOfBirth", label: "Date of birth", type: "date" }, { name: "address", label: "Address" }, { name: "city", label: "City" }, { name: "state", label: "State" }, { name: "pinCode", label: "PIN code" },
    { name: "emergencyContact", label: "Emergency contact" }, { name: "assignedOrganization", label: "Assigned NGO / organization" }, { name: "availability", label: "Availability" }, { name: "skillsAndInterests", label: "Skills and areas of interest", type: "textarea" },
  ],
  ngo: [
    { name: "registrationCertificateNumber", label: "Certificate / registration number" }, { name: "yearEstablished", label: "Year established", type: "number" }, { name: "organizationType", label: "Organization type" }, { name: "panDetails", label: "PAN details" },
    { name: "certificate80G", label: "80G certificate details" }, { name: "certificate12A", label: "12A certificate details" }, { name: "website", label: "Website" }, { name: "address", label: "Full address" },
    { name: "city", label: "City" }, { name: "state", label: "State" }, { name: "pinCode", label: "PIN code" }, { name: "gpsCoordinates", label: "GPS coordinates" },
    { name: "description", label: "Organization description", type: "textarea" }, { name: "areasOfOperation", label: "Areas of operation" }, { name: "beneficiaries", label: "Number of beneficiaries", type: "number" },
    { name: "mainContactPerson", label: "Main contact person" }, { name: "authorizedRepresentative", label: "Authorized representative" },
  ],
  donor: [
    { name: "donorType", label: "Donor type" }, { name: "organizationName", label: "Organization / business name" }, { name: "address", label: "Address" }, { name: "city", label: "City" }, { name: "state", label: "State" }, { name: "pinCode", label: "PIN code" },
  ],
  gaushala: [
    { name: "ownerName", label: "Owner / authorized person" }, { name: "registrationDetails", label: "Trust / society registration details" }, { name: "address", label: "Full address" }, { name: "area", label: "Area" }, { name: "city", label: "City" }, { name: "state", label: "State" }, { name: "pinCode", label: "PIN code" }, { name: "gpsCoordinates", label: "GPS coordinates" },
    { name: "animalTypes", label: "Types of animals" }, { name: "cows", label: "Cows", type: "number" }, { name: "calves", label: "Calves", type: "number" }, { name: "bulls", label: "Bulls", type: "number" }, { name: "buffaloes", label: "Buffaloes", type: "number" },
    { name: "otherAnimals", label: "Other rescued animals", type: "textarea" }, { name: "totalAnimals", label: "Total animals cared for", type: "number" }, { name: "shelterCapacity", label: "Shelter capacity", type: "number" },
    { name: "medicalFacilities", label: "Medical and veterinary facilities", type: "textarea" }, { name: "supportRequirements", label: "Current support requirements", type: "textarea" },
  ],
  sanctuary: [
    { name: "ownerName", label: "Owner / authorized person" }, { name: "registrationDetails", label: "Trust / society registration details" }, { name: "address", label: "Full address" }, { name: "area", label: "Area" }, { name: "city", label: "City" }, { name: "state", label: "State" }, { name: "pinCode", label: "PIN code" }, { name: "gpsCoordinates", label: "GPS coordinates" },
    { name: "animalTypes", label: "Types of animals" }, { name: "otherAnimals", label: "Rescued animal details", type: "textarea" }, { name: "totalAnimals", label: "Total animals cared for", type: "number" }, { name: "shelterCapacity", label: "Shelter capacity", type: "number" },
    { name: "medicalFacilities", label: "Medical and veterinary facilities", type: "textarea" }, { name: "supportRequirements", label: "Current support requirements", type: "textarea" },
  ],
};

export default function RegistrationCreate({ role, onClose, onSaved }: { role: string; onClose: () => void; onSaved: (record: RegistrationRecord) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const items = fields[role] ?? [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile: Record<string, unknown> = {};
    for (const field of items) {
      const value = String(form.get(field.name) ?? "").trim();
      if (!value) continue;
      profile[field.name] = field.type === "number" ? Number(value) : value;
    }
    const assignedOrganization = String(form.get("assignedOrganization") ?? profile.assignedOrganization ?? "").trim();
    setSaving(true);
    setError("");
    try {
      const result = await adminFetch<{ record: RegistrationRecord }>("/api/admin/registrations", {
        method: "POST",
        body: JSON.stringify({
          role,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          registrationId: form.get("registrationId"),
          assignedOrganization,
          profile,
        }),
      });
      onSaved(result.record);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The registration could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  const roleTitle = role === "sanctuary" ? "Animal sanctuary" : role === "gaushala" ? "Gaushala" : role === "ngo" ? "NGO" : role === "volunteer" ? "Volunteer" : "Donor";
  return (
    <Modal title={`Add ${roleTitle.toLowerCase()}`} subtitle="This creates a real registration record in the shared database. It starts pending verification." onClose={onClose} wide footer={<><span style={{ color: "#858077", fontSize: 10 }}>Registration is saved as pending review.</span><button className="btn btn-primary" type="submit" form="registration-create" disabled={saving}>{saving ? "Saving…" : `Save ${roleTitle.toLowerCase()}`}</button></>}>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <form id="registration-create" onSubmit={submit}>
        <div className="form-grid">
          <label><span className="field-label">Full name / organization name *</span><input className="input-control" name="name" required autoFocus maxLength={160} /></label>
          <label><span className="field-label">Registration ID <span style={{ fontWeight: 400, color: "#99938a" }}>(optional)</span></span><input className="input-control" name="registrationId" placeholder="Generated if left blank" maxLength={80} /></label>
          <label><span className="field-label">Email address</span><input className="input-control" type="email" name="email" /></label>
          <label><span className="field-label">Mobile number</span><input className="input-control" name="phone" /></label>
          {items.map((field) => <label className={field.type === "textarea" ? "form-field full" : ""} key={field.name}>
            <span className="field-label">{field.label}</span>
            {field.type === "textarea" ? <textarea className="textarea-control" name={field.name} /> : <input className="input-control" name={field.name} type={field.type ?? "text"} min={field.type === "number" ? "0" : undefined} />}
            {field.hint && <span className="field-hint">{field.hint}</span>}
          </label>)}
        </div>
      </form>
    </Modal>
  );
}
