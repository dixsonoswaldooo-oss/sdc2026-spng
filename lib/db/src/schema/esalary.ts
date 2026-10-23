import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// e-Salary Guard (artifacts/orbyte): the whole demo state as one JSON document per row ("main").
// `version` goes up on every save, so two servers writing at once can't overwrite each other (optimistic locking).
export const esalaryStateTable = pgTable("esalary_state", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  version: integer("version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EsalaryState = typeof esalaryStateTable.$inferSelect;
