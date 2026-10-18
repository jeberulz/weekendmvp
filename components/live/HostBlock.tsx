import { LIVE_ASSETS } from "@/lib/live/config";

export function HostBlock({
  eyebrow = "Host",
  heading,
  body,
}: {
  eyebrow?: string;
  heading?: string;
  body: React.ReactNode;
}) {
  const photo = LIVE_ASSETS.hostHeadshotUrl;
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-4 px-5 sm:flex-row sm:gap-7 sm:px-10">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt="John Iseghohi"
          width={160}
          height={160}
          className="h-24 w-24 rounded-2xl object-cover sm:h-40 sm:w-40"
        />
      ) : null}
      <div>
        <div className="font-mono text-[12px] tracking-[0.08em] text-home-orange uppercase">
          {eyebrow}
        </div>
        {heading ? (
          <h3 className="font-editorial mt-2 text-3xl font-medium tracking-tight">{heading}</h3>
        ) : (
          <h3 className="font-editorial mt-2 text-3xl font-medium tracking-tight">
            John Iseghohi
          </h3>
        )}
        <p className="mt-1 text-[#6B6457]">
          Staff product designer and founder of Weekend MVP.
        </p>
        <div className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-home-ink">{body}</div>
      </div>
    </div>
  );
}
