export type AdminUser = { id: string; name: string; email: string; role: string; active?: boolean; createdAt?: string };
export type AdminPrincipal = { id: string; name: string; email: string; role: string };
export type RegistrationRecord = {
  id: string;
  registrationId: string;
  role: string;
  name: string;
  email: string | null;
  phone: string | null;
  verificationStatus: string;
  accountStatus: string;
  registeredAt: string;
  verifiedAt: string | null;
  verifiedBy?: string | null;
  verificationReason?: string | null;
  adminRemarks?: string | null;
  assignedOrganization: string | null;
  profile: Record<string, unknown>;
};
export type PrivateDocument = { id: string; name: string; category: string; contentType: string; byteSize: number; uploadedAt: string };
export type ActivityRecord = { id: string; activityType: string; title: string; description: string | null; relatedId: string | null; occurredAt: string };
export type DonationJourneyEvent = { status: string; changedAt: string; changedBy?: string; note?: string };
export type FoodDonation = {
  id: string; donationId: string; donorRegistrationId: string | null; donorName: string; foodCategory: string; foodItem: string;
  quantity: number; unit: string; preparedAt: string | null; safeUntil: string | null; foodType: string; storageConditions: string | null;
  pickupLocation: Record<string, unknown>; assignedNgoRegistrationId: string | null; assignedNgoName: string | null; status: string;
  safetyNotes: string | null; journey: DonationJourneyEvent[]; createdAt: string; updatedAt: string; safetyFlag?: boolean;
};
export type Requirement = {
  id: string; requirementId: string; ngoRegistrationId: string; ngoName: string; item: string; category: string;
  requiredQuantity: number; fulfilledQuantity: number; remainingQuantity: number; unit: string; priority: string;
  requiredBy: string | null; location: string | null; status: string; createdAt: string;
};
export type Contribution = {
  id: string; contributionId: string; donorRegistrationId: string | null; donorName: string; ngoRegistrationId: string;
  ngoName: string; requirementId: string; item: string; quantityOffered: number; quantityConfirmed: number;
  quantityReceived: number; unit: string; deliveryPreference: string | null; status: string; contributedAt: string; receivedAt: string | null;
};
export type AdminNotification = { id: string; type: string; title: string; message: string; targetType: string | null; targetId: string | null; readAt: string | null; createdAt: string };
export type AuditRecord = { id: string; adminId: string | null; adminName: string; action: string; entityType: string; entityId: string | null; details: Record<string, unknown>; occurredAt: string };
export type ApiPage<T> = { records: T[]; page: number; limit: number; total: number; pages: number };
export type RegistrationDetail = { record: RegistrationRecord; documents: PrivateDocument[]; activities: ActivityRecord[] };
export type DashboardData = {
  totals: { volunteers: number; ngos: number; donors: number; shelters: number; pendingVerifications: number; activeDonations: number; openRequirements: number; pendingContributions: number; unreadNotifications: number };
  recentRegistrations: RegistrationRecord[]; recentDonations: FoodDonation[]; pendingApprovals: RegistrationRecord[];
  notifications: AdminNotification[]; donationsThisWeek: { day: string; total: number }[];
};
export type ReportData = {
  from: string; to: string; monthly: { month: string; volunteers: number; ngos: number; donors: number; shelters: number; donations: number }[];
  summary: { registrations: number; donations: number; pendingVerifications: number; openRequirements: number; totalRequirements: number; fulfilledRequirements: number; completedContributions: number; receivedContributionQuantity: number };
  rescuedByUnit: { unit: string; quantity: number }[];
};
