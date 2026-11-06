import type { LinkComponent } from "./types";

export const DefaultLink: LinkComponent = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);
