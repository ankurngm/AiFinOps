import { useEffect, useRef, useState } from 'react';
import type { LogsFilters, LogsFiltersResponse } from '../api/types';
import { FiltersBar } from './FiltersBar';

interface FiltersPopoverButtonProps {
  filters: LogsFilters;
  onChange: (next: LogsFilters) => void;
  filterOptions: LogsFiltersResponse | undefined;
}

export function FiltersPopoverButton({
  filters,
  onChange,
  filterOptions,
}: FiltersPopoverButtonProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div className="popover-anchor" ref={anchorRef}>
      <button
        type="button"
        className={open ? 'toolbar-btn open' : 'toolbar-btn'}
        onClick={() => setOpen((v) => !v)}
      >
        + Filters
      </button>
      {open && (
        <div className="popover filters-popover">
          <FiltersBar filters={filters} onChange={onChange} filterOptions={filterOptions} />
          <div className="popover-foot">
            <button type="button" className="clear-link" onClick={() => onChange({})}>
              Clear all
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
