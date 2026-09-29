interface GlobalMessageIconProps {
  className?: string;
}

export function GlobalMessageIcon({ className = "" }: GlobalMessageIconProps) {
  return (
    <img
      src="/global-message-icon.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`object-contain ${className}`}
    />
  );
}