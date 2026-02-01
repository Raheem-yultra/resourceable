export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-primary/20 border-t-primary"></div>
        <p className="mt-4 text-muted-foreground text-sm sm:text-base">Loading...</p>
      </div>
    </div>
  );
}
