import type { Metadata } from "next";
import { RoutePlaceholder, routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("build-pack");
}

export default function BuildPackPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <RoutePlaceholder params={params} slug="build-pack" />;
}
