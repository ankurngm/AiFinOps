interface PaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

const buttonClass =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-slate-50';

export function Pagination({ page, totalPages, totalRows, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        {totalRows.toLocaleString()} {totalRows === 1 ? 'row' : 'rows'}
        {totalPages > 0 ? ` — page ${page} of ${totalPages}` : ''}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
