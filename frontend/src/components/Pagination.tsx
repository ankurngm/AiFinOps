interface PaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalPages,
  totalRows,
  onPageChange,
}: PaginationProps) {
  const shown = totalRows === 0 ? 0 : Math.min(pageSize, totalRows - (page - 1) * pageSize);

  return (
    <div className="foot-row">
      <span>
        Showing {shown} of {totalRows.toLocaleString()} requests
      </span>
      <div className="foot-nav">
        <span>
          page {totalPages === 0 ? 0 : page} of {totalPages}
        </span>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ‹
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          ›
        </button>
      </div>
    </div>
  );
}
