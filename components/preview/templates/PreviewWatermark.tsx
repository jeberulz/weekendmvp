/**
 * WP27-S3. The preview watermark.
 *
 * Part of the template contract, not an overlay a caller can pass or omit:
 * every template renders this unconditionally and takes no prop that could
 * suppress it. A preview that could be screenshotted without the mark, or
 * rendered without it by a caller who simply left an argument out, would
 * undermine the "private, expiring artifact" boundary the whole capability
 * design exists to hold.
 */
export function PreviewWatermark() {
  return (
    <div
      // Presentational: the accessible announcement is the text below, not a
      // duplicated label on the decorative stripe.
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden"
    >
      <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 whitespace-nowrap text-[12vw] font-semibold uppercase tracking-widest text-stone-900/[0.06]">
        Preview
      </p>
    </div>
  );
}

/**
 * The readable counterpart to the decorative mark. Kept separate so the
 * visual watermark can be `aria-hidden` without hiding the fact of the
 * preview from assistive technology.
 */
export function PreviewNotice() {
  return (
    <div className="border-b border-stone-900/10 bg-[#f3f1eb] px-5 py-3 text-center text-sm text-[#44403c]">
      This is a private preview. It expires in 7 days and is not published.
    </div>
  );
}
