import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type RegistrationRole = "volunteer" | "ngo" | "donor" | "gaushala" | "sanctuary";
export type RegistrationProfile = Record<string, unknown>;
export type DonationJourneyEvent = {
  status: string;
  changedAt: string;
  changedBy?: string;
  note?: string;
};

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("super_admin"),
  active: boolean("active").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const registrationRecords = pgTable(
  "registration_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: text("registration_id").notNull().unique(),
    role: text("role").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    verificationStatus: text("verification_status").notNull().default("pending"),
    accountStatus: text("account_status").notNull().default("active"),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by").references(() => adminUsers.id, { onDelete: "set null" }),
    verificationReason: text("verification_reason"),
    adminRemarks: text("admin_remarks"),
    assignedOrganization: text("assigned_organization"),
    profile: jsonb("profile").$type<RegistrationProfile>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("registration_role_status_idx").on(table.role, table.verificationStatus),
    index("registration_name_idx").on(table.name),
  ],
);

export const privateDocuments = pgTable(
  "private_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationRecordId: uuid("registration_record_id")
      .notNull()
      .references(() => registrationRecords.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("supporting document"),
    contentType: text("content_type").notNull(),
    byteSize: numeric("byte_size", { precision: 12, scale: 0, mode: "number" }).notNull(),
    contents: bytea("contents").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("private_document_registration_idx").on(table.registrationRecordId)],
);

export const activityRecords = pgTable(
  "activity_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationRecordId: uuid("registration_record_id")
      .notNull()
      .references(() => registrationRecords.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    relatedId: text("related_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activity_registration_date_idx").on(table.registrationRecordId, table.occurredAt)],
);

export const foodDonations = pgTable(
  "food_donations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    donationId: text("donation_id").notNull().unique(),
    donorRegistrationId: text("donor_registration_id"),
    donorName: text("donor_name").notNull(),
    foodCategory: text("food_category").notNull(),
    foodItem: text("food_item").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
    unit: text("unit").notNull(),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    safeUntil: timestamp("safe_until", { withTimezone: true }),
    foodType: text("food_type").notNull().default("vegetarian"),
    storageConditions: text("storage_conditions"),
    pickupLocation: jsonb("pickup_location").$type<Record<string, unknown>>().notNull().default({}),
    assignedNgoRegistrationId: text("assigned_ngo_registration_id"),
    assignedNgoName: text("assigned_ngo_name"),
    status: text("status").notNull().default("available"),
    safetyNotes: text("safety_notes"),
    journey: jsonb("journey").$type<DonationJourneyEvent[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("food_donation_status_date_idx").on(table.status, table.createdAt)],
);

export const ngoRequirements = pgTable(
  "ngo_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requirementId: text("requirement_id").notNull().unique(),
    ngoRegistrationId: text("ngo_registration_id").notNull(),
    ngoName: text("ngo_name").notNull(),
    item: text("item").notNull(),
    category: text("category").notNull(),
    requiredQuantity: numeric("required_quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
    unit: text("unit").notNull(),
    priority: text("priority").notNull().default("normal"),
    requiredBy: timestamp("required_by", { withTimezone: true }),
    location: text("location"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ngo_requirement_status_date_idx").on(table.status, table.createdAt)],
);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contributionId: text("contribution_id").notNull().unique(),
    donorRegistrationId: text("donor_registration_id"),
    donorName: text("donor_name").notNull(),
    ngoRegistrationId: text("ngo_registration_id").notNull(),
    ngoName: text("ngo_name").notNull(),
    requirementId: text("requirement_id").notNull(),
    item: text("item").notNull(),
    quantityOffered: numeric("quantity_offered", { precision: 12, scale: 3, mode: "number" }).notNull(),
    quantityConfirmed: numeric("quantity_confirmed", { precision: 12, scale: 3, mode: "number" }).notNull().default(0),
    quantityReceived: numeric("quantity_received", { precision: 12, scale: 3, mode: "number" }).notNull().default(0),
    unit: text("unit").notNull(),
    deliveryPreference: text("delivery_preference"),
    status: text("status").notNull().default("offered"),
    contributedAt: timestamp("contributed_at", { withTimezone: true }).notNull().defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contribution_status_date_idx").on(table.status, table.contributedAt)],
);

export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_notification_unread_date_idx").on(table.readAt, table.createdAt)],
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    adminName: text("admin_name").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_audit_date_idx").on(table.occurredAt)],
);
