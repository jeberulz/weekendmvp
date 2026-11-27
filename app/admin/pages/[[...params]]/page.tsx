import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

// The operator must be checked per request before a private form appears.
export const instant = false;

export default function Page() {
  assertEditorialRoutesEnabled();
  return null;
}
