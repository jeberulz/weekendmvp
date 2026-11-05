import type { Metadata } from "next";
import { RoutePlaceholder, routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("tasks");
}

export default function TasksPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <RoutePlaceholder params={params} slug="tasks" />;
}
