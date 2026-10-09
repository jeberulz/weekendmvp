import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage, legalMetadata } from "@/components/public/LegalPage";
import { REFUND_POLICY } from "@/lib/legal/content";
import { legalPagesVisible } from "@/lib/legal/status";

// WP64-S9. A draft: shows in local development, 404s in production until approved.
// The 404 carries no title, description or canonical from the draft either.
export function generateMetadata(): Metadata {
  return legalPagesVisible() ? legalMetadata(REFUND_POLICY) : {};
}

export default function RefundPolicyPage() {
  if (!legalPagesVisible()) notFound();
  return <LegalPage doc={REFUND_POLICY} />;
}
