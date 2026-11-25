export async function adminFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  if (
    process.env.NEXT_PUBLIC_ADMIN_DEMO_MODE === "true" &&
    (!init.method || init.method.toUpperCase() === "GET") &&
    !new URL(input, "http://localhost").pathname.match(/^\/api\/admin\/(init|login|logout)$/)
  ) {
    return frontendDemoResponse(input) as T;
  }

  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(input, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The request could not be completed. Please try again.";
    throw new Error(message);
  }
  return payload as T;
}

function frontendDemoResponse(input: string): unknown {
  const url = new URL(input, "http://localhost");
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const emptyPage = { records: [], page, limit, total: 0, pages: 1 };

  if (url.pathname === "/api/admin/dashboard") {
    return {
      totals: {
        volunteers: 0,
        ngos: 0,
        donors: 0,
        shelters: 0,
        pendingVerifications: 0,
        activeDonations: 0,
        openRequirements: 0,
        pendingContributions: 0,
        unreadNotifications: 0,
      },
      recentRegistrations: [],
      recentDonations: [],
      pendingApprovals: [],
      notifications: [],
      donationsThisWeek: [],
    };
  }
  if (url.pathname === "/api/admin/notifications") {
    return { notifications: [], unreadCount: 0, page, limit, total: 0, pages: 1 };
  }
  if (url.pathname === "/api/admin/search") {
    return { registrations: [], donations: [], requirements: [], contributions: [] };
  }
  if (
    url.pathname === "/api/admin/registrations" ||
    url.pathname === "/api/admin/donations" ||
    url.pathname === "/api/admin/requirements" ||
    url.pathname === "/api/admin/contributions"
  ) {
    return emptyPage;
  }
  if (url.pathname === "/api/admin/reports") {
    return {
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
      monthly: [],
      summary: {
        registrations: 0,
        donations: 0,
        pendingVerifications: 0,
        openRequirements: 0,
        totalRequirements: 0,
        fulfilledRequirements: 0,
        completedContributions: 0,
        receivedContributionQuantity: 0,
      },
      rescuedByUnit: [],
    };
  }
  if (url.pathname === "/api/admin/settings") {
    return {
      account: {
        id: "demo-admin",
        name: "Demo Administrator",
        email: "demo@aifoodbridge.local",
        role: "super_admin",
        active: true,
      },
    };
  }
  if (url.pathname === "/api/admin/admins") return { users: [] };
  if (url.pathname === "/api/admin/audit") return { records: [] };

  throw new Error(`No frontend preview data is configured for ${url.pathname}.`);
}

export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  const body = [headers.map(quote).join(","), ...rows.map((row) => headers.map((header) => quote(row[header])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function displayDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", ...options }).format(date);
}

export function displayDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatRole(role: string) {
  const labels: Record<string, string> = { ngo: "NGO", donor: "Donor", volunteer: "Volunteer", gaushala: "Gaushala", sanctuary: "Sanctuary", food_donation: "Food donation", ngo_requirement: "Requirement" };
  return labels[role] ?? role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
