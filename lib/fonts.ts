import { Newsreader } from "next/font/google";

/**
 * Newsreader italic — the `.accent-italic` serif used by the workshop
 * landing pages (shipable, dare). Legacy pages loaded it from Google Fonts
 * (ital,opsz,wght@1,6..72,400..500); next/font self-hosts the same axes.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: "italic",
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});
