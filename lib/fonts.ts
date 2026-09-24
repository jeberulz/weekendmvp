import { Newsreader } from "next/font/google";

/**
 * Newsreader italic — the `.accent-italic` serif used by the workshop
 * landing pages (shipable, dare). Legacy pages loaded it from Google Fonts
 * (ital,opsz,wght@1,6..72,400..500); next/font self-hosts the same axes.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

/**
 * Newsreader roman + italic — the editorial serif for the WP42 homepage
 * headings. Separate from `newsreader` (italic only) so the workshop pages
 * keep their smaller font payload.
 */
export const newsreaderEditorial = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-editorial-serif",
  display: "swap",
});
