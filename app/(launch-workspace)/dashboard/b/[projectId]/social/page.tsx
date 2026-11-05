import type { Metadata } from "next";
import { RoutePlaceholder, routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("social");
}

export default function SocialPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <RoutePlaceholder params={params} slug="social" />;
}
