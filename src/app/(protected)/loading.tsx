import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Cargando tu espacio"
      className="flex flex-col gap-7"
    >
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-5 w-3/4 max-w-md" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
