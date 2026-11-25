import { NextResponse } from "next/server";
import type { AdminPrincipal } from "@/lib/admin/auth";

export function unauthorized() {
  return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
}

export function forbidden(message = "You do not have permission to perform this action.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = "Something went wrong. Please try again.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function canManageRecords(admin: AdminPrincipal) {
  return ["super_admin", "admin", "verifier"].includes(admin.role);
}

export function canManageOperations(admin: AdminPrincipal) {
  return ["super_admin", "admin"].includes(admin.role);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
}

export function pagination(url: URL) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(5, Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
