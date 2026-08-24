// drizzle.config.ts
//
// Tells drizzle-kit (a dev-only tool — Section 3.4.1 of the Phase 1 plan)
// where the schema lives and where to write migration files. Run
// `npm run db:generate` after any change to src/db/schema.ts.

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
} satisfies Config;
