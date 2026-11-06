import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react/dist/lib/types";
import {
  Baby, Barbell, Bell, Bicycle, BookOpen, Briefcase, Buildings, CalendarCheck, Camera, ChartBar, ChartLineUp, ChatCircle,
  ChatsCircle, CheckCircle, ClipboardText, Clock, Cloud, Code, Coffee, Coins, Compass, CurrencyDollar, DeviceMobile, Drop,
  EnvelopeSimple, FileText, FirstAid, ForkKnife, Gear, Gift, GlobeHemisphereWest, GraduationCap, Handshake, Heart, Hourglass,
  House, Image as ImageGlyph, Laptop, Leaf, Lightbulb, Lightning, ListChecks, LockKey, MagnifyingGlass, MapPin, MapTrifold, Megaphone,
  Microphone, Mountains, MusicNotes, Package, PaintBrush, PawPrint, PencilSimple, PiggyBank, Plant, PuzzlePiece, Receipt,
  RocketLaunch, ShieldCheck, ShoppingBag, Storefront, Sun, Tag, Target, Timer, TrendUp, Truck, User, Users, UsersThree, Wallet,
  ArrowsClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { LANDING_ICONS, type LandingIcon } from "@/lib/workspace/contracts/artifacts";

export type TenantIconWeight = NonNullable<IconProps["weight"]>;

/** One component per `LANDING_ICONS` entry; the `Record` makes a missing one a type error. */
const ICONS: Readonly<Record<LandingIcon, ComponentType<IconProps>>> = {
  clock: Clock, timer: Timer, hourglass: Hourglass, "calendar-check": CalendarCheck, "currency-dollar": CurrencyDollar,
  coins: Coins, wallet: Wallet, "piggy-bank": PiggyBank, receipt: Receipt, tag: Tag, "map-pin": MapPin,
  "map-trifold": MapTrifold, compass: Compass, "globe-hemisphere-west": GlobeHemisphereWest, user: User, users: Users,
  "users-three": UsersThree, handshake: Handshake, heart: Heart, "chat-circle": ChatCircle, "chats-circle": ChatsCircle,
  "envelope-simple": EnvelopeSimple, bell: Bell, megaphone: Megaphone, "chart-line-up": ChartLineUp, "chart-bar": ChartBar,
  "trend-up": TrendUp, target: Target, "shield-check": ShieldCheck, "lock-key": LockKey, "check-circle": CheckCircle,
  lightning: Lightning, "rocket-launch": RocketLaunch, leaf: Leaf, plant: Plant, drop: Drop, sun: Sun,
  mountains: Mountains, "book-open": BookOpen, "graduation-cap": GraduationCap, "pencil-simple": PencilSimple,
  lightbulb: Lightbulb, storefront: Storefront, "shopping-bag": ShoppingBag, package: Package, truck: Truck, gift: Gift,
  coffee: Coffee, "fork-knife": ForkKnife, house: House, buildings: Buildings, briefcase: Briefcase, camera: Camera,
  image: ImageGlyph, microphone: Microphone, "music-notes": MusicNotes, "paint-brush": PaintBrush, code: Code, cloud: Cloud,
  "device-mobile": DeviceMobile, laptop: Laptop, "magnifying-glass": MagnifyingGlass, "list-checks": ListChecks,
  "clipboard-text": ClipboardText, "file-text": FileText, "arrows-clockwise": ArrowsClockwise, gear: Gear,
  "puzzle-piece": PuzzlePiece, barbell: Barbell, bicycle: Bicycle, "paw-print": PawPrint, "first-aid": FirstAid, baby: Baby,
};

/** A decorative Phosphor icon: hidden from assistive technology, coloured by the surrounding text colour. */
export function TenantIcon({ name, weight, className }: { name: LandingIcon; weight: TenantIconWeight; className?: string }) {
  // `name` is a closed-list value, but a plain object also answers to "constructor" and friends.
  if (!LANDING_ICONS.some((icon) => icon === name)) return null;
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" focusable="false" weight={weight} className={className} />;
}
