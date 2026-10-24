/** Three-bar MyLimits mark from mylimits-website/assets/styles.css. */
export function BrandMark({ size = 23 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 21 23"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className="mylimits-mark"
    >
      <rect x="0" y="11" width="5" height="12" rx="2" />
      <rect x="8" y="0" width="5" height="23" rx="2" />
      <rect x="16" y="6" width="5" height="17" rx="2" />
    </svg>
  );
}
