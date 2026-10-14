// Audit Trail Component — Attendance Corrections + System Activity
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  Filter,
  History,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

type AuditTab = 'ATTENDANCE' | 'SYSTEM';

interface SystemEvent {
  id: string;
  actor: string | null;
  action: string;
  resource: string | null;
  recordId: string | null;
  details: Record<string, any>;
  createdAt: string;
}

// Human-friendly labels for action codes coming from the backend
const ACTION_LABELS: Record<string, string> = {
  create: 'Record created',
  update: 'Record updated',
  delete: 'Record deleted',
  storage_write: 'Storage saved',
  storage_delete: 'Storage cleared',
  storage_bulk_sync: 'Storage bulk sync',
  account_create: 'User created',
  account_update: 'User updated',
  account_delete: 'User deleted',
  account_password_reset: 'Password reset',
  initial_super_admin_created: 'Initial admin created',
  demo_accounts_seeded: 'Demo accounts seeded',
  admin_reset_empty: 'Database emptied',
  admin_reset_to_demo: 'Database reset to demo',
  migration_import: 'Import from backup',
  initial_setup: 'First-run setup',
};

function humanAction(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// Summary of the details object — one short line
function summariseDetails(details: Record<string, any>): string {
  if (!details || Object.keys(details).length === 0) return '—';
  const parts: string[] = [];
  if (details.keys_removed !== undefined) parts.push(`${details.keys_removed} key(s) removed`);
  if (details.keys_imported !== undefined) parts.push(`${details.keys_imported} key(s) imported`);
  if (details.fields) parts.push(`fields: ${(details.fields as string[]).join(', ')}`);
  if (details.target_username) parts.push(`target: ${details.target_username}`);
  if (details.target_role) parts.push(`role: ${details.target_role}`);
  if (details.mode) parts.push(`mode: ${details.mode}`);
  if (details.bytes !== undefined) parts.push(`${details.bytes} bytes`);
  if (details.role && !details.target_role) parts.push(`role: ${details.role}`);
  if (details.schoolId) parts.push(`school: ${details.schoolId}`);
  if (parts.length === 0) {
    // Fall back to first 2 keys
    Object.entries(details)
      .slice(0, 2)
      .forEach(([k, v]) => parts.push(`${k}: ${String(v).slice(0, 40)}`));
  }
  return parts.join(' · ');
}

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();
  const [activeTab, setActiveTab] = useState<AuditTab>('ATTENDANCE');

  // --- Attendance log filters (existing behavior) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('ALL');

  // --- System activity state ---
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [systemActionFilter, setSystemActionFilter] = useState('ALL');
  const [systemActorFilter, setSystemActorFilter] = useState('ALL');
  const [systemSearch, setSystemSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // --- Attendance: filtered + unique editors ---
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (selectedUserFilter !== 'ALL' && log.changedByUserId !== selectedUserFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          log.studentName.toLowerCase().includes(q) ||
          log.reason?.toLowerCase().includes(q) ||
          log.date.includes(q) ||
          log.changedByUserName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, searchTerm, selectedUserFilter]);

  const uniqueEditors = useMemo(() => {
    const map = new Map<string, string>();
    auditLogs.forEach((l) => map.set(l.changedByUserId, l.changedByUserName));
    return Array.from(map.entries());
  }, [auditLogs]);

  // --- System: fetch from /api/audit ---
  const fetchSystemEvents = async () => {
    setSystemLoading(true);
    setSystemError(null);
    try {
      const res = await fetch('/api/audit?limit=500', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setSystemEvents(Array.isArray(data.items) ? data.items : []);
      setLastRefresh(new Date());
    } catch (err: any) {
      setSystemError(err.message || 'Could not load system activity.');
    } finally {
      setSystemLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'SYSTEM' && systemEvents.length === 0 && !systemLoading) {
      fetchSystemEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // --- System: filtering + derived options ---
  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    systemEvents.forEach((e) => set.add(e.action));
    return Array.from(set).sort();
  }, [systemEvents]);

  const uniqueActors = useMemo(() => {
    const set = new Set<string>();
    systemEvents.forEach((e) => {
      if (e.actor) set.add(e.actor);
    });
    return Array.from(set).sort();
  }, [systemEvents]);

  const filteredSystemEvents = useMemo(() => {
    return systemEvents.filter((e) => {
      if (systemActionFilter !== 'ALL' && e.action !== systemActionFilter) return false;
      if (systemActorFilter !== 'ALL' && e.actor !== systemActorFilter) return false;
      if (systemSearch.trim()) {
        const q = systemSearch.toLowerCase();
        const haystack = [
          e.action,
          e.resource || '',
          e.recordId || '',
          e.actor || '',
          JSON.stringify(e.details || {}),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      }
      return true;
    });
  }, [systemEvents, systemActionFilter, systemActorFilter, systemSearch]);

  const clearSystemFilters = () => {
    setSystemActionFilter('ALL');
    setSystemActorFilter('ALL');
    setSystemSearch('');
  };

  const hasSystemFilters =
    systemActionFilter !== 'ALL' || systemActorFilter !== 'ALL' || systemSearch.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Official Audit Trail
          </h2>
          <p className="text-xs text-slate-500">
            Immutable log of every system action and attendance correction with
            editor signatures.
          </p>
        </div>

        {activeTab === 'SYSTEM' && (
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                Refreshed {formatTime(lastRefresh.toISOString())}
              </span>
            )}
            <button
              onClick={fetchSystemEvents}
              disabled={systemLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
              title="Reload system activity from server"
            >
              {systemLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs flex gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'ATTENDANCE'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserCheck className={`w-4 h-4 ${activeTab === 'ATTENDANCE' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span>Attendance Corrections</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              activeTab === 'ATTENDANCE'
                ? 'bg-slate-800 text-emerald-300'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {auditLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SYSTEM')}
          className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'SYSTEM'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Database className={`w-4 h-4 ${activeTab === 'SYSTEM' ? 'text-amber-400' : 'text-slate-400'}`} />
          <span>System Activity</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              activeTab === 'SYSTEM'
                ? 'bg-slate-800 text-amber-300'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {systemEvents.length}
          </span>
        </button>
      </div>

      {/* ───────────────────────── ATTENDANCE TAB ───────────────────────── */}
      {activeTab === 'ATTENDANCE' && (
        <>
          {/* Filters bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student, editor, or note..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Editors</option>
              {uniqueEditors.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Corrections Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <History className="w-8 h-8 mx-auto text-slate-300" />
                <div className="text-xs font-semibold">No attendance corrections recorded yet</div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Any time a previously saved attendance mark is modified, the
                  change is automatically timestamped and displayed here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold">
                      <th className="py-2.5 px-3 w-40">Timestamp</th>
                      <th className="py-2.5 px-3 w-36">Editor</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Student Affected</th>
                      <th className="py-2.5 px-3 w-28">School Date</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Previous Value</th>
                      <th className="py-2.5 px-3 min-w-[160px]">New Corrected Value</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Reason / Audit Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {log.changedByUserName}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {log.studentName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {log.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-rose-700 bg-rose-50/30">
                          {log.oldValue}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-800 bg-emerald-50/30 font-semibold">
                          {log.newValue}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {log.reason || 'Manual correction via register UI'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ───────────────────────── SYSTEM ACTIVITY TAB ───────────────────────── */}
      {activeTab === 'SYSTEM' && (
        <>
          {/* Filters bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search action, resource, actor, or details..."
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Action filter */}
              <select
                value={systemActionFilter}
                onChange={(e) => setSystemActionFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
              >
                <option value="ALL">All Actions</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>
                    {humanAction(a)}
                  </option>
                ))}
              </select>

              {/* Actor filter */}
              <select
                value={systemActorFilter}
                onChange={(e) => setSystemActorFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
              >
                <option value="ALL">All Actors</option>
                {uniqueActors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

              {hasSystemFilters && (
                <button
                  type="button"
                  onClick={clearSystemFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {hasSystemFilters && (
              <div className="text-[11px] text-slate-500 px-1">
                Showing <strong className="text-slate-800">{filteredSystemEvents.length}</strong> of{' '}
                <strong className="text-slate-800">{systemEvents.length}</strong> events
              </div>
            )}
          </div>

          {/* System Activity Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {systemLoading && systemEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-slate-300" />
                <div className="text-xs font-semibold">Loading system activity…</div>
              </div>
            ) : systemError ? (
              <div className="p-8 text-center space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
                <div className="text-xs font-semibold text-rose-700">
                  Could not load system activity
                </div>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  {systemError}
                </p>
                <button
                  onClick={fetchSystemEvents}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : filteredSystemEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Database className="w-8 h-8 mx-auto text-slate-300" />
                <div className="text-xs font-semibold">
                  {systemEvents.length === 0
                    ? 'No system activity logged yet'
                    : 'No events match your filters'}
                </div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  {systemEvents.length === 0
                    ? 'Actions such as creating users, editing classes, or updating the school profile will appear here.'
                    : 'Try clearing filters or broadening your search.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold">
                      <th className="py-2.5 px-3 w-44">Timestamp</th>
                      <th className="py-2.5 px-3 w-36">Actor</th>
                      <th className="py-2.5 px-3 w-44">Action</th>
                      <th className="py-2.5 px-3 w-40">Resource</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredSystemEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                          {formatTime(event.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                          {event.actor || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                            {humanAction(event.action)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-[180px]">
                          {event.resource || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600">
                          {summariseDetails(event.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};