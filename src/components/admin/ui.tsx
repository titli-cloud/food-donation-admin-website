"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, FileQuestion } from "lucide-react";

export type TableColumn<T> = { key: string; title: string; render: (row: T) => ReactNode; className?: string };

export function PageHeading({ eyebrow = "Operations", title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-description">{description}</p></div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`status status-${status.toLowerCase().replaceAll(" ", "_")}`}>{status.replaceAll("_", " ")}</span>;
}

export function EmptyState({ title = "Nothing to show yet", description, icon }: { title?: string; description: string; icon?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <FileQuestion size={19} />}</div><h3 className="empty-title">{title}</h3><p className="empty-copy">{description}</p></div>;
}

export function TablePanel<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyTitle,
  emptyDescription,
  onRowClick,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  loading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <div className="table-card">{Array.from({ length: 7 }, (_, index) => <div key={index} className="loading-row" />)}</div>;
  if (!rows.length) return <div className="table-card"><EmptyState title={emptyTitle} description={emptyDescription ?? "When records are available, they will appear here."} /></div>;
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>{columns.map((column) => <th className={column.className} key={column.key}>{column.title}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id} className={onRowClick ? "clickable-row" : undefined} onClick={() => onRowClick?.(row)}>{columns.map((column) => <td className={column.className} key={column.key}>{column.render(row)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PageFooter({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (next: number) => void }) {
  if (!total) return null;
  const from = (page - 1) * 10 + 1;
  const to = Math.min(page * 10, total);
  return (
    <div className="table-footer">
      <span>Showing {from}–{to} of {total.toLocaleString()}</span>
      <div className="pagination-actions">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /> Previous</button>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">Next <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

export function Modal({ title, subtitle, children, footer, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head"><div><h2 className="modal-title">{title}</h2>{subtitle && <p className="modal-subtitle">{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>×</span></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}
