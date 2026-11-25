export const sectionPermissions: Record<string, string[]> = {
  dashboard: ["super_admin", "admin", "verifier", "analyst"],
  volunteers: ["super_admin", "admin", "verifier"],
  ngos: ["super_admin", "admin", "verifier"],
  donors: ["super_admin", "admin", "verifier"],
  shelters: ["super_admin", "admin", "verifier"],
  donations: ["super_admin", "admin", "verifier", "analyst"],
  requirements: ["super_admin", "admin", "verifier", "analyst"],
  contributions: ["super_admin", "admin", "verifier", "analyst"],
  verifications: ["super_admin", "admin", "verifier"],
  reports: ["super_admin", "admin", "verifier", "analyst"],
  notifications: ["super_admin", "admin", "verifier", "analyst"],
  settings: ["super_admin", "admin", "verifier", "analyst"],
};
