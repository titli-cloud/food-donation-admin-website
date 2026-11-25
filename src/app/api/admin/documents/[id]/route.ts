import { eq } from "drizzle-orm";
import { db } from "@/db";
import { privateDocuments } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { canManageRecords, forbidden, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageRecords(admin)) return forbidden("Your role does not allow document access.");
  const { id } = await params;
  const [document] = await db.select({ name: privateDocuments.name, contentType: privateDocuments.contentType, contents: privateDocuments.contents }).from(privateDocuments).where(eq(privateDocuments.id, id)).limit(1);
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  const safeType = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(document.contentType) ? document.contentType : "application/octet-stream";
  return new Response(new Uint8Array(document.contents), {
    headers: {
      "Content-Type": safeType,
      "Content-Disposition": `inline; filename="${document.name.replace(/[\r\n"\\]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
