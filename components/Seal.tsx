import { useId, type ReactNode } from "react";

export function Seal({
  ringText,
  core,
  id,
  size = 120,
  rotate = -10,
  color = "var(--color-home-orange)",
  className,
}: {
  ringText: string;
  core: ReactNode;
  id?: string;
  size?: number;
  rotate?: number;
  color?: string;
  className?: string;
}) {
  const uniqueId = useId();
  const ringId = id ?? uniqueId;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      style={{ color, transform: `rotate(${rotate}deg)`, flexShrink: 0 }}
    >
      <defs>
        <path id={ringId} d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <text className="font-mono" fontSize="10.4" fontWeight={500} fill="currentColor">
        <textPath href={`#${ringId}`} textLength="286" lengthAdjust="spacing">
          {ringText}
        </textPath>
      </text>
      {typeof core === "string" ? (
        <text x="60" y="68" textAnchor="middle" className="font-editorial italic" fontSize="30" fill="currentColor">
          {core}
        </text>
      ) : core}
    </svg>
  );
}
