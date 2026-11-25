"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LayoutDashboard,
  Link2,
  MessagesSquare,
  RefreshCw,
  Search,
  SearchX,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { DashboardData, Days } from "@/lib/types";
import { refreshDashboard } from "./actions";
import { ReportsSkeleton } from "./report-skeleton";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const count = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const refreshedDate = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
});

const ranges: Days[] = [7, 30, 90];
function AnimatedAmount({ value, format }: { value: number; format: Intl.NumberFormat }) {
  const visible = useRef<HTMLSpanElement>(null);
  const previous = useRef({ value, format });
  const label = format.format(value);

  useLayoutEffect(() => {
    const node = visible.current;
    const from = previous.current.value;
    if (!node) return;
    if (from === value || previous.current.format !== format || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.textContent = format.format(value);
      previous.current = { value, format };
      return;
    }

    node.textContent = format.format(from);
    const start = performance.now();
    let frame = requestAnimationFrame(update);
    function update(time: number) {
      const progress = Math.min((time - start) / 280, 1);
      const current = from + (value - from) * (1 - (1 - progress) ** 3);
      previous.current = { value: progress < 1 ? current : value, format };
      if (node) node.textContent = format.format(previous.current.value);
      if (progress < 1) frame = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(frame);
  }, [format, value]);

  return (
    <span className="animated-amount">
      <span className="loading-status">{label}</span>
      <span ref={visible} aria-hidden="true">{label}</span>
    </span>
  );
}

function Value({ value, format = count, animate = false }: {
  value: number | null;
  format?: Intl.NumberFormat;
  animate?: boolean;
}) {
  if (value === null) return <span className="missing" aria-label="Unavailable">—</span>;
  return animate ? <AnimatedAmount value={value} format={format} /> : <>{format.format(value)}</>;
}

function Wordmark() {
  return (
    <a className="wordmark" href="#overview">
      <span className="brand-symbol" aria-hidden="true"><Activity size={28} strokeWidth={2.5} /></span>
      <span><span className="brand-name">Agency Desk</span><span className="brand-subtitle">Infloww workspace</span></span>
    </a>
  );
}

function Metric({
  label, value, format, note,
}: {
  label: string;
  value: number | null;
  format?: Intl.NumberFormat;
  note: ReactNode;
}) {
  return (
    <div className="metric-cell">
      <dt className="metric-label">{label}</dt>
      <dd className="metric-value"><Value value={value} format={format} animate /></dd>
      <dd className="metric-note">{note}</dd>
    </div>
  );
}

function RevenueChange({ data }: { data: DashboardData }) {
  if (data.revenue === null || data.previousRevenue === null) return <>Previous period unavailable</>;
  const change = data.revenue - data.previousRevenue;
  if (change === 0) return <>Unchanged vs previous {data.days} days</>;
  const direction = change > 0 ? "+" : "−";
  const relative = data.previousRevenue > 0 ? Math.abs(change) / data.previousRevenue : null;
  const usePercent = relative !== null && relative >= 0.0005;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <>
      <span className={change > 0 ? "positive delta" : "negative delta"}>
        <Icon size={13} aria-hidden="true" /> {direction}<Value value={usePercent ? relative : Math.abs(change)} format={usePercent ? percent : money} animate />
      </span>{" "}
      vs previous {data.days} days
    </>
  );
}

function SectionHeader({ id, title, subtitle, meta }: {
  id: string;
  title: string;
  subtitle: string;
  meta?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div><h2 id={id}>{title}</h2><p>{subtitle}</p></div>
      {meta && <span className="section-meta">{meta}</span>}
    </header>
  );
}

const emptyIllustrations = {
  earnings: ChartNoAxesCombined,
  mix: ChartPie,
  creators: UserRound,
  chatters: MessagesSquare,
  promotions: Link2,
  audience: UsersRound,
  search: SearchX,
};

function Empty({ kind, children }: { kind: keyof typeof emptyIllustrations; children: ReactNode }) {
  const Illustration = emptyIllustrations[kind];
  return (
    <div className="empty">
      <span className="empty-illustration" aria-hidden="true"><Illustration size={28} strokeWidth={1.5} /></span>
      <p>{children}</p>
    </div>
  );
}

function dateRange(start: string, end: string) {
  const first = new Date(start);
  const last = new Date(end);
  if (start === end) return fullDate.format(last);
  const startLabel = start.slice(0, 4) === end.slice(0, 4) ? shortDate.format(first) : fullDate.format(first);
  return `${startLabel} – ${fullDate.format(last)}`;
}

function niceStep(span: number) {
  if (span === 0) return 0;
  const rough = span / 4;
  const unit = 10 ** Math.floor(Math.log10(rough));
  return ([1, 2, 2.5, 5, 10].find((size) => size * unit >= rough) ?? 10) * unit;
}

function RevenueChart({ series }: { series: DashboardData["series"] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  if (!series.length) return <Empty kind="earnings">Daily revenue is unavailable for this period.</Empty>;

  const first = series[0];
  const last = series[series.length - 1];
  const low = Math.min(0, ...series.map(({ revenue }) => revenue));
  const high = Math.max(0, ...series.map(({ revenue }) => revenue));
  const step = niceStep(high - low);
  const min = step ? Math.floor(low / step) * step : 0;
  const max = step ? Math.ceil(high / step) * step : 0;
  const span = max - min;
  const width = 640;
  const height = 152;
  const y = (value: number) => span ? height - ((value - min) / span) * height : height;
  const points = series.map((point, index) => ({
    ...point,
    x: series.length > 1 ? index * width / (series.length - 1) : width / 2,
    y: y(point.revenue),
  }));
  const ticks = step
    ? Array.from({ length: Math.round(span / step) + 1 }, (_, index) => max - index * step)
    : [0];
  const axisDays = [...new Set([0, 1, 2, 3, 4].map((index) => Math.round(index * (series.length - 1) / 4)))];
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  const selectedPoint = selected === null ? undefined : points[selected];
  const activePoint = selectedPoint ?? (preview === null ? undefined : points[preview]);
  const baseline = y(0);
  const activeText = activePoint
    ? `${fullDate.format(new Date(activePoint.date))}: ${money.format(activePoint.revenue)}`
    : undefined;

  function dayAt(clientX: number, input: HTMLInputElement) {
    const bounds = input.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    return Math.round(fraction * (series.length - 1));
  }

  function clearSelection() {
    setSelected(null);
    setPreview(null);
  }

  return (
    <div className="chart">
      <div className="chart-body">
        <div className="chart-axis" aria-hidden="true">
          {ticks.map((tick) => <span className="chart-label" key={tick} style={{ top: `${y(tick) / height * 100}%` }}>{compactMoney.format(tick)}</span>)}
        </div>
        <div className="chart-plot">
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Daily revenue, ${dateRange(first.date, last.date)}`}>
            {ticks.map((tick) => <line className="chart-rule" key={tick} x1={0} x2={width} y1={y(tick)} y2={y(tick)} />)}
            <g className="chart-series">
              <polygon className="chart-area" points={`0,${baseline} ${path} ${width},${baseline}`} />
              <polyline className="chart-line" points={path} />
            </g>
            {points.length === 1 && !activePoint && <circle className="chart-point" cx={points[0].x} cy={points[0].y} r={3} />}
            {activePoint && (
              <>
                <line className="chart-pointer" x1={activePoint.x} x2={activePoint.x} y1={0} y2={height} />
                <circle className="chart-point" cx={activePoint.x} cy={activePoint.y} r={4} />
              </>
            )}
          </svg>
          <input
            className="chart-slider"
            type="range"
            min={0}
            max={Math.max(series.length - 1, 1)}
            value={selected ?? preview ?? series.length - 1}
            aria-label="Explore daily revenue"
            aria-valuetext={activeText ?? `${fullDate.format(new Date(last.date))}: ${money.format(last.revenue)}`}
            onFocus={() => setPreview(current => current ?? series.length - 1)}
            onBlur={clearSelection}
            onPointerLeave={() => setPreview(null)}
            onChange={event => setSelected(Math.min(event.currentTarget.valueAsNumber, series.length - 1))}
            onClick={event => {
              const input = event.currentTarget;
              setSelected(event.detail ? dayAt(event.clientX, input) : Math.min(input.valueAsNumber, series.length - 1));
            }}
            onPointerUp={event => {
              if (event.pointerType === "mouse") return;
              event.currentTarget.focus({ preventScroll: true });
              setSelected(dayAt(event.clientX, event.currentTarget));
            }}
            onPointerMove={event => {
              if (selected !== null || event.pointerType !== "mouse" || event.buttons !== 0) return;
              setPreview(dayAt(event.clientX, event.currentTarget));
            }}
            onKeyDown={event => {
              if (event.key === "Escape") {
                event.preventDefault();
                clearSelection();
              }
            }}
          />
          {selectedPoint && (
            <div
              className="chart-tooltip"
              data-placement={selectedPoint.y < height / 2 ? "below" : "above"}
              aria-hidden="true"
              style={{
                left: `clamp(min(var(--tooltip-half), 50%), ${selectedPoint.x / width * 100}%, max(50%, calc(100% - var(--tooltip-half))))`,
                top: `${selectedPoint.y / height * 100}%`,
              }}
            >
              <time dateTime={selectedPoint.date}>{fullDate.format(new Date(selectedPoint.date))}</time>
              <strong className="num">{money.format(selectedPoint.revenue)}</strong>
            </div>
          )}
        </div>
      </div>
      <div className="chart-days" aria-hidden="true">
        {axisDays.map((index) => <span className="chart-label" key={points[index].date} style={{ left: `${points[index].x / width * 100}%` }}>{shortDate.format(new Date(points[index].date))}</span>)}
      </div>
      <p className="chart-readout">
        {activePoint
          ? <>{fullDate.format(new Date(activePoint.date))} <span aria-hidden="true">·</span> <strong>{money.format(activePoint.revenue)}</strong></>
          : <>Select a day to see its net earnings.</>}
      </p>
    </div>
  );
}

function RevenueMix({ rows, version }: { rows: DashboardData["revenueMix"]; version: string }) {
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  const biggest = Math.max(0, ...sorted.map((row) => Math.abs(row.revenue)));
  const total = sorted.reduce((sum, row) => sum + row.revenue, 0);
  const top = sorted[0];
  const share = total > 0 && top && top.revenue <= total ? top.revenue / total : null;
  return (
    <section className="panel mix-panel" aria-labelledby="revenue-mix-title">
      <SectionHeader id="revenue-mix-title" title="Revenue mix" subtitle="Net earnings by transaction type" />
      {sorted.length ? (
        <ul className="mix-list">
          {sorted.map(({ label, revenue }) => (
            <li key={label}>
              <div className="mix-label"><span>{label.replace(/([a-z])([A-Z])/g, "$1 $2")}</span><strong className="num"><Value value={revenue} format={money} animate /></strong></div>
              <span className="mix-track" aria-hidden="true">
                <span key={version} className="mix-fill" style={{ transform: `scaleX(${biggest > 0 ? Math.abs(revenue) / biggest : 0})` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : <Empty kind="mix">No revenue breakdown for this period.</Empty>}
      {share !== null && (
        <p className="mix-insight"><strong className="num"><Value value={share} format={percent} animate /></strong> of net earnings came from {top.label.replace(/([a-z])([A-Z])/g, "$1 $2").toLocaleLowerCase()}.</p>
      )}
    </section>
  );
}

function Identity({ name, subline, id }: { name: string; subline?: string; id?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join("").toLocaleUpperCase();
  const tint = id ? Array.from(id).reduce((acc, letter) => (acc * 31 + (letter.codePointAt(0) ?? 0)) % 997, 0) % 5 : 0;
  return (
    <span className="identity">
      {id && <span aria-hidden="true" className={`person-mark tint-${tint}`}>{initials}</span>}
      <span className="identity-text"><strong>{name}</strong>{subline && <small>{subline}</small>}</span>
    </span>
  );
}

interface DetailRow {
  id: string;
  identity: ReactNode;
  searchable: string;
  metrics: ReactNode[];
}

function ReportTable({ columns, items, label }: {
  columns: string[];
  items: DetailRow[];
  label: string;
}) {
  if (!items.length) return <Empty kind="search">No matches for this search.</Empty>;
  return (
    <div className="table-scroll">
      <table className="detail-table" role="table" aria-label={label}>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((column, index) => <th key={column} scope="col" role="columnheader" className={index === 0 ? undefined : "num"}>{column}</th>)}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {items.map(({ id, identity, metrics }) => (
            <tr key={id} role="row">
              <th className="row-identity" scope="row" role="rowheader">{identity}</th>
              {metrics.map((metric, index) => (
                <td className="num" role="cell" key={columns[index + 1]}>
                  <span className="mobile-cell-label" aria-hidden="true">{columns[index + 1]}</span>
                  {metric}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailTable({ columns, rows, label, cap = 3 }: {
  columns: string[];
  rows: DetailRow[];
  label: string;
  cap?: number;
}) {
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 15;
  const query = search.trim().toLocaleLowerCase();
  const filtered = query ? rows.filter(row => row.searchable.toLocaleLowerCase().includes(query)) : rows;
  const visiblePage = Math.min(pageIndex, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const offset = visiblePage * pageSize;
  const items = filtered.slice(offset, offset + pageSize);

  useLayoutEffect(() => {
    scrollArea.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [query, visiblePage]);

  function openPanel() {
    setSearch("");
    const panel = dialog.current;
    if (panel) {
      const root = document.documentElement;
      root.style.setProperty("--drawer-scrollbar-gutter", `${window.innerWidth - root.getBoundingClientRect().width}px`);
      panel.inert = false;
      panel.removeAttribute("aria-hidden");
      panel.showModal();
    }
    setPageIndex(0);
    scrollArea.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <>
      <ReportTable columns={columns} items={rows.slice(0, cap)} label={label} />
      {rows.length > cap && (
        <>
          <button className="table-expand" type="button" aria-haspopup="dialog" aria-controls={dialogId} onClick={openPanel}>
            View all {count.format(rows.length)} <ArrowUpRight size={14} aria-hidden="true" />
          </button>
          <dialog
            id={dialogId}
            ref={dialog}
            className="report-drawer"
            inert
            aria-hidden="true"
            onClose={event => {
              const panel = event.currentTarget;
              if (!panel.open) {
                panel.inert = true;
                panel.setAttribute("aria-hidden", "true");
                if (!document.querySelector(".report-drawer[open]")) {
                  document.documentElement.style.removeProperty("--drawer-scrollbar-gutter");
                }
              }
            }}
            aria-labelledby={`${dialogId}-title`}
            onClick={event => {
              if (event.target === event.currentTarget) event.currentTarget.close();
            }}
          >
            <div className="report-drawer-content">
              <header className="report-drawer-header">
                <div>
                  <h2 id={`${dialogId}-title`}>{label}</h2>
                  <p>{count.format(rows.length)} {rows.length === 1 ? "result" : "results"} in this period</p>
                </div>
                <button className="control drawer-close" type="button" aria-label="Close report" onClick={() => dialog.current?.close()}>
                  <X size={19} aria-hidden="true" />
                </button>
              </header>
              {rows.length > pageSize && (
                <label className="table-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    aria-label={`Search ${label.toLocaleLowerCase()}`}
                    placeholder="Search by name"
                    type="search"
                    value={search}
                    onChange={event => {
                      setSearch(event.currentTarget.value);
                      setPageIndex(0);
                    }}
                  />
                </label>
              )}
              <div className="report-drawer-table" ref={scrollArea} tabIndex={0} role="region" aria-label={`${label} results`}>
                <ReportTable columns={columns} items={items} label={label} />
              </div>
              {filtered.length > pageSize && (
                <div className="table-pages">
                  <span className="num" aria-live="polite">{count.format(offset + 1)}–{count.format(offset + items.length)} of {count.format(filtered.length)}</span>
                  <button className="control" type="button" disabled={offset === 0} onClick={() => setPageIndex(visiblePage - 1)}><ChevronLeft size={16} aria-hidden="true" />Previous</button>
                  <button className="control" type="button" disabled={offset + items.length >= filtered.length} onClick={() => setPageIndex(visiblePage + 1)}>Next<ChevronRight size={16} aria-hidden="true" /></button>
                </div>
              )}
            </div>
          </dialog>
        </>
      )}
    </>
  );
}

function Creators({ rows }: { rows: DashboardData["creators"] }) {
  return (
    <section id="creators" className="panel detail-panel" aria-labelledby="creator-title">
      <SectionHeader id="creator-title" title="Creator performance" subtitle="Ranked by net earnings" meta={`${count.format(rows.length)} profiles`} />
      {rows.length ? (
        <DetailTable
          label="Creator performance"
          columns={["Creator", "Net earnings", "New subs", "Active fans"]}
          rows={rows.map((row) => ({
            id: row.id,
            searchable: `${row.name} ${row.handle}`,
            identity: <Identity name={row.name} id={row.id} subline={row.handle ? `@${row.handle.replace(/^@/, "")}` : undefined} />,
            metrics: [<Value value={row.revenue} format={money} />, <Value value={row.subscribers} />, <Value value={row.activeFans} />],
          }))}
        />
      ) : <Empty kind="creators">No creator profiles are available.</Empty>}
    </section>
  );
}

function Chatters({ rows }: { rows: DashboardData["chatters"] }) {
  return (
    <section id="chatters" className="panel detail-panel" aria-labelledby="chatter-title">
      <SectionHeader id="chatter-title" title="Chatter performance" subtitle="Employee sales and messaging activity" />
      {rows.length ? (
        <DetailTable
          label="Chatter performance"
          columns={["Chatter", "Sales", "Messages", "Fan chats", "PPV unlock rate"]} // taste-skill-ignore: Infloww metric terminology
          rows={rows.map((row) => ({
            id: row.id,
            searchable: row.name,
            identity: <Identity name={row.name} id={row.id} />,
            metrics: [
              <Value value={row.sales} format={money} />, <Value value={row.messages} />,
              <Value value={row.fans} />, <Value value={row.unlockRate} format={percent} />,
            ],
          }))}
        />
      ) : <Empty kind="chatters">No chatter performance is available for this period.</Empty>}
    </section>
  );
}

function Promotions({ rows }: { rows: DashboardData["promotions"] }) {
  return (
    <section id="promotions" className="panel detail-panel" aria-labelledby="promotions-title">
      <SectionHeader id="promotions-title" title="Promotions" subtitle="Cumulative results for links created in this period" />
      {rows.length ? (
        <DetailTable
          label="Promotional link performance"
          columns={["Link", "Clicks", "Subs / claims", "Net earnings"]}
          rows={rows.map((row) => ({
            id: row.id,
            searchable: `${row.name} ${row.creator} ${row.type}`,
            identity: <Identity name={row.name} subline={[row.creator, row.type].filter(Boolean).join(" · ")} />,
            metrics: [<Value value={row.clicks} />, <Value value={row.subscribers} />, <Value value={row.revenue} format={money} />],
          }))}
        />
      ) : <Empty kind="promotions">No promotional links are available.</Empty>}
    </section>
  );
}

function Audience({ data }: { data: DashboardData }) {
  const list = data.creators
    .filter((row) => row.subscribers !== null)
    .sort((a, b) => (b.subscribers ?? 0) - (a.subscribers ?? 0))
    .slice(0, 3);

  return (
    <section id="audience" className="panel detail-panel" aria-labelledby="audience-title">
      <SectionHeader id="audience-title" title="Audience" subtitle="New subscribers and end-of-period creator fan counts" />
      <div className="audience-strip">
        <div><span>New subscribers</span><strong className="num"><Value value={data.subscribers} animate /></strong></div>
        <div><span>Active fans</span><strong className="num"><Value value={data.activeFans} animate /></strong></div>
      </div>
      {list.length ? (
        <ul className="audience-list">
          {list.map((row) => <li className="list-line" key={row.id}><span>{row.name}</span><strong className="num"><Value value={row.subscribers} /></strong></li>)}
        </ul>
      ) : <Empty kind="audience">Subscriber counts by creator are unavailable for this period.</Empty>}
    </section>
  );
}

export default function Dashboard({ data: initialData }: { data: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [selection, setSelection] = useState(initialData.days);
  const [status, setStatus] = useState<"idle" | "loading" | "refreshing" | "error">("idle");
  const inFlight = useRef<AbortController | null>(null);
  const pending = selection !== data.days;
  const refreshing = status === "refreshing";
  const available = data.revenue !== null || data.creators.length > 0 || data.chatters.length > 0 || data.promotions.length > 0;

  const load = useCallback(async (days: Days, refresh = false) => {
    inFlight.current?.abort();
    if (days !== data.days) document.querySelector<HTMLDialogElement>(".report-drawer[open]")?.close();
    setSelection(days);
    if (days === data.days && !refresh) {
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    inFlight.current = controller;
    setStatus(refresh ? "refreshing" : "loading");
    try {
      const result = refresh
        ? await refreshDashboard(days)
        : await fetch(`/api/dashboard?days=${days}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
            if (!response.ok) throw new Error("Dashboard request failed");
            const report: DashboardData = await response.json();
            if (report.days !== days) throw new Error("Invalid reporting period");
            return report;
          });
      if (controller.signal.aborted) return;
      setData(result);
      setStatus("idle");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }, [data.days]);

  useEffect(() => {
    function restorePeriod() {
      const days = new URLSearchParams(window.location.search).get("days");
      void load(days === "7" ? 7 : days === "90" ? 90 : 30);
    }
    window.addEventListener("popstate", restorePeriod);
    return () => window.removeEventListener("popstate", restorePeriod);
  }, [load]);

  useEffect(() => () => inFlight.current?.abort(), []);

  function choosePeriod(days: Days) {
    if (days === selection && status !== "error") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("days") !== String(days)) {
      url.searchParams.set("days", String(days));
      window.history.pushState(null, "", url);
    }
    void load(days);
  }

  const displayedStart = pending
    ? new Date(Date.parse(data.end) - (selection - 1) * 86_400_000).toISOString().slice(0, 10)
    : data.start;
  const reportVersion = data.fetchedAt + "-" + data.days;

  return (
    <div className="agency-shell">
      <header className="top-bar">
        <div className="top-bar-inner">
          <Wordmark />
          <nav aria-label="Dashboard sections">
            <a className="nav-link current" href="#overview" aria-current="page"><LayoutDashboard size={16} aria-hidden="true" />Overview</a>
          </nav>
          <p className="report-source">
            Source: Infloww <span aria-hidden="true">·</span> {available ? "Fetched" : "Last attempted"} <time dateTime={data.fetchedAt}>{refreshedDate.format(new Date(data.fetchedAt)).replace(/\s/g, " ")} UTC</time>
          </p>

        </div>
      </header>
      <main id="overview" className="workspace">
        <div className="workspace-inner">
          <header className="page-header">
            <div>
              <h1>Agency overview</h1>
              <p>Creator earnings, chatter sales and subscriber growth.</p>
            </div>
            <div className="header-tools">
              <button
                className="control"
                type="button"
                disabled={refreshing || pending}
                onClick={() => void load(selection, true)}
              >
                <RefreshCw size={14} aria-hidden="true" />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </header>
          <div className="scope-row">
            <span className="scope-date"><CalendarDays size={15} aria-hidden="true" /> {dateRange(displayedStart, data.end)} UTC</span>
            <nav className="range-options" aria-label="Reporting period">
              <span className="range-indicator" style={{ transform: `translateX(${ranges.indexOf(selection) * 100}%)` }} aria-hidden="true" />
              {ranges.map(days => (
                <a
                  key={days}
                  href={`?days=${days}`}
                  aria-current={days === selection ? "page" : undefined}
                  onClick={event => {
                    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                    event.preventDefault();
                    choosePeriod(days);
                  }}
                >{days} days</a>
              ))}
            </nav>
          </div>
          {status === "loading" && <p role="status" className="loading-status">Loading the {selection}-day report from Infloww…</p>}
          {status === "error" && (
            <div className="coverage report-error" role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              <p>{pending ? "This reporting period could not be loaded." : "The report could not be refreshed."}</p>
              <button className="control" type="button" onClick={() => void load(selection, !pending)}>Retry</button>
            </div>
          )}
          {pending && status === "loading" && <ReportsSkeleton />}
          <div className="report-content" hidden={pending} aria-busy={refreshing}>
            {data.issues.length > 0 && (
              <div className="coverage">
                <CircleAlert size={15} aria-hidden="true" />
                <details>
                  <summary>{available ? "Some reports are incomplete" : "Infloww data could not be loaded"}</summary>
                  <ul>
                    {data.issues.map(({ section, message }, index) => <li key={`${section}-${index}`}><strong>{section}</strong> · {message}</li>)}
                  </ul>
                </details>
              </div>
            )}
            <dl className="panel metric-strip">
              <Metric label="Net earnings" value={data.revenue} format={money} note={<RevenueChange data={data} />} />
              <Metric label="New subscribers" value={data.subscribers} note="Across creator profiles" />
              <Metric label="Active fans" value={data.activeFans} note="Profile total at period end" />
              <Metric label="Chatter sales" value={data.chatterSales} format={money} note="Employee-attributed sales" />
            </dl>
            <div className="dashboard-grid">
              <section className="panel trend-panel" aria-labelledby="revenue-title">
                <SectionHeader
                  id="revenue-title"
                  title="Earnings over time"
                  subtitle="Daily settled earnings after platform fees"
                  meta="USD"
                />
                <RevenueChart key={reportVersion} series={data.series} />
              </section>
              <RevenueMix version={reportVersion} rows={data.revenueMix} />
              <Creators key={`creators-${reportVersion}`} rows={data.creators} />
              <Promotions key={`promotions-${reportVersion}`} rows={data.promotions} />
              <Chatters key={`chatters-${reportVersion}`} rows={data.chatters} />
              <Audience data={data} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
