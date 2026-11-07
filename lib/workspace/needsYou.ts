/**
 * One definition of "need you": the number of OPEN reviews waiting on the
 * founder, meaning pending review cards that have not expired. A paused step is
 * not a review, so it is never counted here (it keeps its own wording). The nav
 * badge, the Team HQ heading and the Dashboard team strip all read this.
 */

/** Reviews still open: the query never reads the clock, so a card past `expiresAt` is left out here. */
export function openReviews<T extends { readonly expiresAt: number }>(reviews: readonly T[], now: number): T[] {
  return reviews.filter((review) => review.expiresAt > now);
}

/** How many reviews need the founder right now. */
export function needsYouCount(reviews: readonly { readonly expiresAt: number }[], now: number): number {
  return openReviews(reviews, now).length;
}

/** The Team HQ heading tail for a count of open reviews. */
export function needsYouTail(count: number): string {
  if (count === 0) return "Nobody needs you right now.";
  return count === 1 ? "1 needs you." : `${count.toString()} need you.`;
}
