import { defineApp } from "convex/server";
import { v } from "convex/values";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp({
  env: {
    PLATFORM_BILLING_BRIDGE_SECRET: v.string(),
  },
});

// WP26-S3: durable Validation Report execution. The component owns its own
// journal tables, so mounting it changes no application table.
app.use(workflow);

export default app;
