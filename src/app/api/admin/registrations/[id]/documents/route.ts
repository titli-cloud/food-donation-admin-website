import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, privateDocuments, registrationRecords } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { canManageRecords, forbidden, requestIp, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const supportedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

function signatureMatches(type: string, bytes: Buffer) {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageRecords(admin)) return forbidden("Your role does not allow document access.");
  const { id } = await params;
  const [record] = await db.select({ id: registrationRecords.id, registrationId: registrationRecords.registrationId }).from(registrationRecords).where(eq(registrationRecords.id, id)).limit(1);
  if (!record) return Response.json({ error: "Registration record not found." }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Choose a valid PDF or image document." }, { status: 400 });
  }
  const file = form.get("file");
  const category = typeof form.get("category") === "string" ? String(form.get("category")).trim().slice(0, 80) : "supporting document";
  if (!(file instanceof File) || file.size < 1 || file.size > maxBytes || !supportedTypes.has(file.type)) {
    return Response.json({ error: "Choose a PDF, JPEG, PNG, or WebP file no larger than 10 MB." }, { status: 400 });
  }
  const contents = Buffer.from(await file.arrayBuffer());
  if (!signatureMatches(file.type, contents)) return Response.json({ error: "The file contents do not match the selected document type." }, { status: 400 });
  const safeName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "document";
  const [document] = await db.insert(privateDocuments).values({
    registrationRecordId: record.id,
    name: safeName,
    category: category || "supporting document",
    contentType: file.type,
    byteSize: file.size,
    contents,
  }).returning({ id: privateDocuments.id, name: privateDocuments.name, category: privateDocuments.category, contentType: privateDocuments.contentType, byteSize: privateDocuments.byteSize, uploadedAt: privateDocuments.uploadedAt });
  await db.insert(adminAuditLogs).values({
    adminId: admin.id,
    adminName: admin.name,
    action: "registration_document_uploaded",
    entityType: "registration",
    entityId: record.id,
    details: { registrationId: record.registrationId, documentId: document.id, category: document.category },
    ipAddress: requestIp(request),
  });
  return Response.json({ document }, { status: 201 });
}
