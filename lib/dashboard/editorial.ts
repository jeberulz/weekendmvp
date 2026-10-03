import "server-only";
import { connection } from "next/server";

import { getHomeData } from "@/lib/home/data";
import { toDashboardEditorial, type DashboardEditorial } from "./editorial-map";

export type { DashboardEditorial } from "./editorial-map";

/**
 * Reads the homepage's hourly cache, so the dashboard's idea of the week and
 * newest ideas always match `/`. Returns null instead of throwing: a missing
 * weekly pick must never take the signed-in workspace down.
 */
export async function getDashboardEditorial(): Promise<DashboardEditorial | null> {
  // Do not catch Next's prerender interruption. It must make the route
  // request-time before the visibility query or the current clock is read.
  await connection();
  try {
    return toDashboardEditorial(await getHomeData());
  } catch (error) {
    console.error("Dashboard editorial data is unavailable", error);
    return null;
  }
}
