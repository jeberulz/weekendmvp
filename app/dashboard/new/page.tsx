import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SIGNED_IN_HREF } from "@/lib/signed-in-chrome";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NewIdeaPage() {
  redirect(SIGNED_IN_HREF.home);
}
