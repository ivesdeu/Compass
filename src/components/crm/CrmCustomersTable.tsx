import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CUSTOMERS_COLUMN_DEFS,
  defaultPillColorForOption,
  selectOptionsForColumn,
  type CrmColumnDef,
  type CrmOptionColors,
  type CrmPillColorKey,
} from '@/lib/crm-customers-schema';
import { cn } from '@/lib/utils';
import { SelectPill } from './SelectPill';

export type CrmTableRowVm = {
  id: string;
  draft: boolean;
  inserted: boolean;
  retainer: boolean;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  preferredChannel: string;
  communicationStyle: string;
  status: string;
  priority: string;
  projects: string;
  revenue: string;
  allocated: string;
  profit: string;
  profitNegative: boolean;
  margin: string;
  roi: string;
  updated: string;
};

export type CrmCustomersTablePayload = {
  rows: CrmTableRowVm[];
  columnPrefs: Record<string, boolean>;
  optionColors: CrmOptionColors;
  projectStatuses: string[];
};

export type CrmTableFocusRequest = {
  rowId: string;
  colId: string;
  activate: boolean;
};

function colVisible(def: CrmColumnDef, prefs: Record<string, boolean>) {
  if (def.locked) return true;
  return prefs[def.id] !== false;
}

function visibleEditableColIds(prefs: Record<string, boolean>) {
  return CUSTOMERS_COLUMN_DEFS.filter((c) => c.editable && !c.locked && colVisible(c, prefs)).map((c) => c.id);
}

function valueForField(row: CrmTableRowVm, fieldKey: string): string {
  const map: Record<string, string> = {
    companyName: row.companyName,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    preferredChannel: row.preferredChannel,
    communicationStyle: row.communicationStyle,
    status: row.status,
    priority: row.priority,
  };
  return map[fieldKey] ?? '';
}

function resolvePillColor(
  selectKey: string,
  label: string,
  optionColors: CrmOptionColors,
): CrmPillColorKey {
  const from = optionColors[selectKey]?.[label];
  if (from) return from;
  return defaultPillColorForOption(selectKey, label);
}

function isSelectLike(def: CrmColumnDef) {
  return (
    def.fieldKind === 'select' ||
    def.fieldKind === 'status' ||
    def.fieldKind === 'priority'
  );
}

function isCustomersPageActive() {
  const pg = document.getElementById('page-customers');
  return pg?.classList.contains('on') ?? false;
}

type CrmCustomersTableProps = CrmCustomersTablePayload & {
  focusRequest: CrmTableFocusRequest | null;
  onConsumedFocus: () => void;
  onPatchField: (
    clientId: string,
    fieldKey: string,
    value: string,
    colId: string,
  ) => Promise<boolean>;
  onRevertField: (clientId: string, fieldKey: string, previous: string) => void;
  onLeaveRow: (rowId: string) => void;
};

export function CrmCustomersTable({
  rows,
  columnPrefs,
  optionColors,
  projectStatuses,
  focusRequest,
  onConsumedFocus,
  onPatchField,
  onRevertField,
  onLeaveRow,
}: CrmCustomersTableProps) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedColId, setSelectedColId] = useState<string | null>(null);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const lastClickKeyRef = useRef<string | null>(null);
  const snapshotRef = useRef<string>('');
  const anchorRef = useRef<DOMRect | null>(null);
  const portalOpenRef = useRef(false);
  const [, bump] = useState(0);
  const errFlashRef = useRef<string | null>(null);

  const openSelectPortal = useCallback((rect: DOMRect | null) => {
    anchorRef.current = rect;
    portalOpenRef.current = true;
    bump((n) => n + 1);
  }, []);

  const closePortal = useCallback(() => {
    anchorRef.current = null;
    portalOpenRef.current = false;
    bump((n) => n + 1);
  }, []);

  const clearSelection = useCallback(() => {
    setActiveCellId(null);
    setSelectedRowId(null);
    setSelectedColId(null);
    lastClickKeyRef.current = null;
    closePortal();
  }, [closePortal]);

  useEffect(() => {
    if (!focusRequest) return;
    setSelectedRowId(focusRequest.rowId);
    setSelectedColId(focusRequest.colId);
    lastClickKeyRef.current = `${focusRequest.rowId}:${focusRequest.colId}`;
    if (focusRequest.activate) {
      const key = `${focusRequest.rowId}:${focusRequest.colId}`;
      setActiveCellId(key);
      const def = CUSTOMERS_COLUMN_DEFS.find((c) => c.id === focusRequest.colId);
      const row = rows.find((r) => r.id === focusRequest.rowId);
      if (def?.fieldKey && row) snapshotRef.current = valueForField(row, def.fieldKey);
    }
    onConsumedFocus();
  }, [focusRequest, onConsumedFocus, rows]);

  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (document.getElementById('customers-table')?.contains(t)) return;
      if ((ev.target as HTMLElement).closest?.('[data-crm-table-portal]')) return;
      clearSelection();
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [clearSelection]);

  const flashError = useCallback((cellId: string) => {
    errFlashRef.current = cellId;
    bump((n) => n + 1);
    window.setTimeout(() => {
      errFlashRef.current = null;
      bump((n) => n + 1);
    }, 1400);
  }, []);

  const commitValue = useCallback(
    async (rowId: string, colId: string, next: string) => {
      const def = CUSTOMERS_COLUMN_DEFS.find((c) => c.id === colId);
      if (!def?.fieldKey) return;
      const ok = await onPatchField(rowId, def.fieldKey, next, colId);
      if (!ok) flashError(`${rowId}:${colId}`);
      setActiveCellId(null);
      closePortal();
    },
    [onPatchField, flashError, closePortal],
  );

  const activateEdit = useCallback(
    (rowId: string, colId: string, rect: DOMRect | null) => {
      const def = CUSTOMERS_COLUMN_DEFS.find((c) => c.id === colId);
      const row = rows.find((r) => r.id === rowId);
      if (!def?.editable || !def.fieldKey || !row) return;
      if (!isSelectLike(def)) closePortal();
      const key = `${rowId}:${colId}`;
      setActiveCellId(key);
      snapshotRef.current = valueForField(row, def.fieldKey);
      if (isSelectLike(def)) openSelectPortal(rect);
      else closePortal();
    },
    [rows, openSelectPortal, closePortal],
  );

  const moveAfterCommit = useCallback(
    (fromRowId: string, fromColId: string, deltaCol: number, deltaRow: number) => {
      const cols = visibleEditableColIds(columnPrefs);
      const ci = cols.indexOf(fromColId);
      const ri = rows.findIndex((r) => r.id === fromRowId);
      if (ci < 0 || ri < 0) return;
      const nr = Math.max(0, Math.min(rows.length - 1, ri + deltaRow));
      const nrow = rows[nr];
      if (!nrow) return;
      const ncol =
        deltaRow !== 0 && deltaCol === 0
          ? fromColId
          : cols[Math.max(0, Math.min(cols.length - 1, ci + deltaCol))];
      if (!ncol) return;
      setActiveCellId(null);
      closePortal();
      setSelectedRowId(nrow.id);
      setSelectedColId(ncol);
      lastClickKeyRef.current = `${nrow.id}:${ncol}`;
      window.requestAnimationFrame(() => {
        const td = document.querySelector<HTMLElement>(
          `tr[data-client-id="${nrow.id}"] td[data-col-id="${ncol}"]`,
        );
        activateEdit(nrow.id, ncol, td?.getBoundingClientRect() ?? null);
        const inp = td?.querySelector<HTMLInputElement>('.crm-cell-input');
        if (inp) {
          inp.focus();
          inp.select?.();
        }
      });
    },
    [columnPrefs, rows, closePortal, activateEdit],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!isCustomersPageActive()) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === 'Tab' && activeCellId && portalOpenRef.current) {
        ev.preventDefault();
        const [rowId, colId] = activeCellId.split(':');
        setActiveCellId(null);
        closePortal();
        moveAfterCommit(rowId, colId, ev.shiftKey ? -1 : 1, 0);
        return;
      }

      if (ev.key === 'Escape' && activeCellId) {
        ev.preventDefault();
        const [rowId, colId] = activeCellId.split(':');
        const def = CUSTOMERS_COLUMN_DEFS.find((c) => c.id === colId);
        if (def?.fieldKey) onRevertField(rowId, def.fieldKey, snapshotRef.current);
        setActiveCellId(null);
        closePortal();
        return;
      }

      const inputEl = (ev.target as HTMLElement)?.closest?.('.crm-cell-input') as
        | HTMLInputElement
        | null
        | undefined;
      if (inputEl && activeCellId) {
        const [rowId, colId] = activeCellId.split(':');
        if (ev.key === 'Tab') {
          ev.preventDefault();
          const raw =
            inputEl.type === 'number' ? String(inputEl.value || '') : String(inputEl.value || '').trim();
          void (async () => {
            await commitValue(rowId, colId, raw);
            moveAfterCommit(rowId, colId, ev.shiftKey ? -1 : 1, 0);
          })();
          return;
        }
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const raw =
            inputEl.type === 'number' ? String(inputEl.value || '') : String(inputEl.value || '').trim();
          void (async () => {
            await commitValue(rowId, colId, raw);
            moveAfterCommit(rowId, colId, 0, 1);
          })();
          return;
        }
        return;
      }

      if (activeCellId || !selectedRowId || !selectedColId) return;
      if (ev.key.length === 1 && !ev.key.match(/\s/)) {
        const def = CUSTOMERS_COLUMN_DEFS.find((c) => c.id === selectedColId);
        if (!def?.editable || !def.fieldKey || def.fieldKind === 'checkbox') return;
        if (isSelectLike(def)) return;
        ev.preventDefault();
        activateEdit(selectedRowId, selectedColId, null);
        window.requestAnimationFrame(() => {
          const inp = document.querySelector<HTMLInputElement>(
            `tr[data-client-id="${selectedRowId}"] td[data-col-id="${selectedColId}"] input.crm-cell-input`,
          );
          if (inp) {
            inp.value = ev.key;
            inp.focus();
            inp.select();
          }
        });
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [
    activeCellId,
    selectedRowId,
    selectedColId,
    onRevertField,
    closePortal,
    commitValue,
    moveAfterCommit,
    activateEdit,
  ]);

  const onCellMouseDown = useCallback(
    (ev: React.MouseEvent, rowId: string, colId: string, def: CrmColumnDef) => {
      if ((ev.target as HTMLElement).closest('button')) return;
      const key = `${rowId}:${colId}`;
      if (
        def.editable &&
        selectedRowId === rowId &&
        selectedColId === colId &&
        lastClickKeyRef.current === key &&
        !activeCellId
      ) {
        const td = (ev.currentTarget as HTMLElement).closest('td');
        activateEdit(rowId, colId, td?.getBoundingClientRect() ?? null);
        lastClickKeyRef.current = null;
        return;
      }
      setActiveCellId(null);
      closePortal();
      setSelectedRowId(rowId);
      setSelectedColId(colId);
      lastClickKeyRef.current = key;
    },
    [selectedRowId, selectedColId, activeCellId, activateEdit, closePortal],
  );

  const selectPortal =
    activeCellId && portalOpenRef.current && anchorRef.current
      ? (() => {
          const rect = anchorRef.current!;
          const [rowId, colId] = activeCellId.split(':');
          const def = CUSTOMERS_COLUMN_DEFS.find((c) => c.id === colId);
          if (!def?.selectKey) return null;
          const opts = selectOptionsForColumn(def, projectStatuses);
          const row = rows.find((r) => r.id === rowId);
          const cur = row && def.fieldKey ? valueForField(row, def.fieldKey) : '';
          const top = Math.min(rect.bottom + 4, window.innerHeight - 8 - 200);
          const left = Math.min(Math.max(4, rect.left), window.innerWidth - 228);
          return createPortal(
            <div
              data-crm-table-portal
              className="fixed z-[300] max-h-[min(320px,70vh)] w-56 overflow-y-auto rounded-lg border border-[var(--border2)] bg-[var(--bg2)] py-1 shadow-lg"
              style={{ left, top }}
              role="listbox"
            >
              {opts.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] hover:bg-[var(--bg3)]',
                    String(opt) === String(cur) && 'bg-[var(--bg3)]',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    void (async () => {
                      if (!def.fieldKey) return;
                      const ok = await onPatchField(rowId, def.fieldKey, opt, colId);
                      if (!ok) flashError(activeCellId);
                      setActiveCellId(null);
                      closePortal();
                    })();
                  }}
                >
                  <SelectPill label={opt} color={resolvePillColor(def.selectKey, opt, optionColors)} />
                </button>
              ))}
            </div>,
            document.body,
          );
        })()
      : null;

  return (
    <>
      {rows.map((row) => (
        <tr
          key={row.id}
          data-client-id={row.id}
          className={cn('crm-row', selectedRowId === row.id && 'bg-gray-50')}
          onBlur={(ev) => {
            const rel = ev.relatedTarget as Node | null;
            if (rel && (ev.currentTarget as HTMLElement).contains(rel)) return;
            if (rel && (rel as HTMLElement).closest?.('[data-crm-table-portal]')) return;
            onLeaveRow(row.id);
          }}
        >
          {CUSTOMERS_COLUMN_DEFS.map((def) => {
            const key = `${row.id}:${def.id}`;
            const isActive = activeCellId === key;
            const err = errFlashRef.current === key;
            return (
              <td
                key={def.id}
                data-client-id={row.id}
                data-col-id={def.id}
                tabIndex={-1}
                className={cn(
                  'crm-cell td-truncate px-2 py-2 align-middle text-[13px]',
                  def.id === 'company' && 'max-w-[200px]',
                  def.id === 'email' && 'max-w-[220px]',
                  def.id === 'phone' && 'max-w-[130px]',
                  isActive && 'border-2 border-blue-500',
                  err && 'border-2 border-red-500',
                )}
                onMouseDown={(e) => {
                  if (def.id === 'actions') return;
                  if (def.fieldKind === 'checkbox' && def.editable) return;
                  onCellMouseDown(e, row.id, def.id, def);
                }}
              >
                {def.id === 'actions' ? (
                  <div className="flex flex-nowrap gap-1.5">
                    <button type="button" className="btn" data-client-edit={row.id}>
                      Full record
                    </button>
                    <button type="button" className="btn text-[var(--red)]" data-client-del={row.id}>
                      Delete
                    </button>
                  </div>
                ) : !def.editable ? (
                  def.id === 'projects' ? (
                    row.projects
                  ) : def.id === 'revenue' ? (
                    row.revenue
                  ) : def.id === 'allocated' ? (
                    row.allocated
                  ) : def.id === 'profit' ? (
                    <span className={cn('tabular-nums', row.profitNegative && 'text-[var(--red)]')}>
                      {row.profit}
                    </span>
                  ) : def.id === 'margin' ? (
                    row.margin
                  ) : def.id === 'roi' ? (
                    row.roi
                  ) : def.id === 'updated' ? (
                    row.updated
                  ) : (
                    '—'
                  )
                ) : isSelectLike(def) && def.selectKey ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    {(() => {
                      const raw = def.fieldKey ? valueForField(row, def.fieldKey) : '';
                      const label = raw.trim() || '—';
                      return label !== '—' ? (
                        <SelectPill
                          label={label}
                          color={resolvePillColor(def.selectKey, label, optionColors)}
                        />
                      ) : (
                        <span className="text-[var(--text3)]">—</span>
                      );
                    })()}
                    {def.id === 'status' && row.retainer ? (
                      <span className="whitespace-nowrap text-[10px] font-semibold text-[var(--coral)]">
                        Retainer
                      </span>
                    ) : null}
                  </div>
                ) : def.fieldKind === 'number' ? (
                  isActive ? (
                    <input
                      type="number"
                      className="crm-cell-input w-full border-0 bg-transparent p-0 text-[13px] text-inherit outline-none"
                      defaultValue={def.fieldKey ? valueForField(row, def.fieldKey) : ''}
                      autoFocus
                      onBlur={(e) => void commitValue(row.id, def.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          if (def.fieldKey) onRevertField(row.id, def.fieldKey, snapshotRef.current);
                          setActiveCellId(null);
                          closePortal();
                        }
                      }}
                    />
                  ) : (
                    (def.fieldKey && valueForField(row, def.fieldKey)) || '—'
                  )
                ) : def.fieldKind === 'date' ? (
                  isActive ? (
                    <input
                      type="date"
                      className="crm-cell-input w-full border-0 bg-transparent p-0 text-[13px] outline-none"
                      defaultValue={def.fieldKey ? valueForField(row, def.fieldKey) : ''}
                      autoFocus
                      onBlur={(e) => void commitValue(row.id, def.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          if (def.fieldKey) onRevertField(row.id, def.fieldKey, snapshotRef.current);
                          setActiveCellId(null);
                        }
                      }}
                    />
                  ) : (
                    (def.fieldKey && valueForField(row, def.fieldKey)) || '—'
                  )
                ) : def.fieldKind === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={
                      def.fieldKey
                        ? valueForField(row, def.fieldKey) === 'true' ||
                          valueForField(row, def.fieldKey) === '1'
                        : false
                    }
                    onChange={(e) =>
                      void onPatchField(
                        row.id,
                        def.fieldKey || '',
                        e.target.checked ? 'true' : 'false',
                        def.id,
                      )
                    }
                  />
                ) : isActive ? (
                  <input
                    type="text"
                    className="crm-cell-input w-full border-0 bg-transparent p-0 text-[13px] text-inherit outline-none"
                    defaultValue={def.fieldKey ? valueForField(row, def.fieldKey) : ''}
                    autoFocus
                    onBlur={(e) => void commitValue(row.id, def.id, e.target.value.trim())}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        if (def.fieldKey) onRevertField(row.id, def.fieldKey, snapshotRef.current);
                        setActiveCellId(null);
                        closePortal();
                      }
                    }}
                  />
                ) : (
                  (def.fieldKey && valueForField(row, def.fieldKey)) || '—'
                )}
              </td>
            );
          })}
        </tr>
      ))}
      {selectPortal}
    </>
  );
}
