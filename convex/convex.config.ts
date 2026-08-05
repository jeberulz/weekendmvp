import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    PLATFORM_BILLING_BRIDGE_SECRET: v.string(),
  },
});

export default app;
