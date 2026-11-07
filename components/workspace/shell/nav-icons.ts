import {
  ArrowRight,
  CodeXml,
  Flag,
  Folder,
  LayoutGrid,
  ListTodo,
  Mail,
  Megaphone,
  Palette,
  PenLine,
  Settings,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceNavId } from "@/lib/workspace/routes";

/** One lucide icon per nav row (Nav board). Decorative: every row also has text. */
export const NAV_ICONS: Readonly<Partial<Record<WorkspaceNavId, LucideIcon>>> = {
  team: Users,
  launch: Flag,
  pack: CodeXml,
  brand: Palette,
  dashboard: LayoutGrid,
  tasks: ListTodo,
  email: Mail,
  ads: Megaphone,
  studio: PenLine,
  outbound: ArrowRight,
  social: Share2,
  files: Folder,
  settings: Settings,
};
