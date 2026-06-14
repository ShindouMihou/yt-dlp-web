export function PreviewSkeleton() {
  return (
    <div className="flex gap-4" aria-hidden="true">
      <div className="aspect-video w-32 shrink-0 rounded-xl shimmer sm:w-40" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="h-4 w-3/4 rounded shimmer" />
        <div className="h-4 w-1/2 rounded shimmer" />
        <div className="mt-1 h-3 w-1/3 rounded shimmer" />
      </div>
    </div>
  );
}
