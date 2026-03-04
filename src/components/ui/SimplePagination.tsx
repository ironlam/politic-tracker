import Link from "next/link";

interface SimplePaginationProps {
  page: number;
  totalPages: number;
  buildUrl: (page: number) => string;
}

export function SimplePagination({ page, totalPages, buildUrl }: SimplePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex justify-center gap-2 mt-8">
      {page > 1 && (
        <Link href={buildUrl(page - 1)} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80">
          Précédent
        </Link>
      )}
      <span className="px-4 py-2 text-muted-foreground" aria-current="page">
        Page {page} sur {totalPages}
      </span>
      {page < totalPages && (
        <Link href={buildUrl(page + 1)} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80">
          Suivant
        </Link>
      )}
    </nav>
  );
}
