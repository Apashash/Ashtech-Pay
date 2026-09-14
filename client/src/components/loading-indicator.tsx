type LoadingIndicatorProps = {
  className?: string;
};

export function LoadingIndicator({ className = "" }: LoadingIndicatorProps) {
  return (
    <img
      src="/loading.gif"
      alt=""
      aria-hidden="true"
      className={`h-20 w-20 object-contain ${className}`}
    />
  );
}

export function LoadingScreen() {
  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center"
      role="status"
      aria-label="Chargement"
    >
      <LoadingIndicator />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}