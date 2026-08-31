import { useEffect, useRef, useState } from 'react';
import { buildExportUrl } from '../api/client';
import type { LogsFilters } from '../api/types';

interface DownloadMenuProps {
  filters: LogsFilters;
}

export function DownloadMenu({ filters }: DownloadMenuProps) {
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
        Download ▾
      </button>
      {open && (
        <div className="popover download-menu">
          <a
            className="menu-item"
            href={buildExportUrl('csv', filters)}
            onClick={() => setOpen(false)}
          >
            Export CSV
          </a>
          <a
            className="menu-item"
            href={buildExportUrl('jsonl', filters)}
            onClick={() => setOpen(false)}
            title="Full request/response, one JSON object per line"
          >
            Export full (JSONL)
          </a>
        </div>
      )}
    </div>
  );
}
