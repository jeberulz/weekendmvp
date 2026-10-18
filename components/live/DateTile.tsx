export function DateTile({
  month,
  day,
  weekday,
}: {
  month: string;
  day: string;
  weekday: string;
}) {
  return (
    <div className="w-[68px] flex-none overflow-hidden rounded-xl border border-home-rule bg-home-card text-center max-sm:w-14">
      <div className="bg-home-orange px-0 py-0.5 font-mono text-[11px] tracking-[0.1em] text-white uppercase">
        {month}
      </div>
      <div className="font-editorial text-[32px] leading-tight max-sm:text-[26px]">{day}</div>
      <div className="pb-1.5 font-mono text-[10px] tracking-[0.1em] text-[#6B6457] uppercase">
        {weekday}
      </div>
    </div>
  );
}
