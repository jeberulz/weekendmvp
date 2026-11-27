/** Installed only in the isolated test server and each fresh browser document. */
export default function freezeDate(instant) {
  const RealDate = Date;
  const now = RealDate.parse(instant);
  if (!Number.isFinite(now)) throw new Error("Invalid visual test instant");
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length ? args : [now], newTarget);
    },
    apply() {
      return new RealDate(now).toString();
    },
    get(target, key, receiver) {
      if (key === "now") return () => now;
      return Reflect.get(target, key, receiver);
    },
  });
}

if (process.env.LANDING_VISUAL_CLOCK) freezeDate(process.env.LANDING_VISUAL_CLOCK);
