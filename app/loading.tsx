import { Activity, CalendarDays, LayoutDashboard, RefreshCw } from "lucide-react";
import { ReportsSkeleton } from "./report-skeleton";

export default function Loading() {
  return (
    <>
      <p role="status" className="loading-status">Loading agency reports from Infloww…</p>
      <div className="agency-shell dashboard-skeleton" aria-hidden="true">
        <header className="top-bar">
          <div className="top-bar-inner">
            <div className="wordmark">
              <span className="brand-symbol"><Activity size={28} strokeWidth={2.5} /></span>
              <span><span className="brand-name">Agency Desk</span><span className="brand-subtitle">Infloww workspace</span></span>
            </div>
            <span className="nav-link current"><LayoutDashboard size={16} />Overview</span>
            <p className="report-source">Source: Infloww <span className="skeleton-bar" style={{ inlineSize: 152 }} /></p>
          </div>
        </header>
        <main className="workspace" aria-busy="true">
          <div className="workspace-inner">
            <header className="page-header">
              <div><h1>Agency overview</h1><p>Creator earnings, chatter sales and subscriber growth.</p></div>
              <div className="header-tools"><span className="control"><RefreshCw size={14} /> Refresh</span></div>
            </header>
            <div className="scope-row">
              <span className="scope-date"><CalendarDays size={15} /><span className="skeleton-bar" style={{ inlineSize: 140 }} /></span>
              <div className="range-options">{[7, 30, 90].map(days => <span key={days}>{days} days</span>)}</div>
            </div>
            <ReportsSkeleton />
          </div>
        </main>
      </div>
    </>
  );
}
