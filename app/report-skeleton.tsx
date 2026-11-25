const rows = [0, 1, 2];
const metrics = [
  ["Net earnings", "vs previous period"],
  ["New subscribers", "Across creator profiles"],
  ["Active fans", "Profile total at period end"],
  ["Chatter sales", "Employee-attributed sales"],
];

function Bar({ width }: { width: number }) {
  return <span className="skeleton-bar" style={{ inlineSize: width }} />;
}

function Heading({ title, subtitle, meta }: { title: string; subtitle: string; meta?: string }) {
  return (
    <div className="section-header">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      {meta && <span className="section-meta">{meta}</span>}
    </div>
  );
}

function TableSkeleton({ id, title, subtitle, columns, avatar = false }: {
  id: string;
  title: string;
  subtitle: string;
  columns: string[];
  avatar?: boolean;
}) {
  return (
    <section id={id} className="panel detail-panel">
      <Heading title={title} subtitle={subtitle} />
      <table className="detail-table">
        <thead>
          <tr>{columns.map((label, index) => <th key={label} className={index ? "num" : undefined}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row}>
              <th className="row-identity">
                <span className="identity">
                  {avatar && <span className="person-mark skeleton-avatar" />}
                  <span className="identity-text"><Bar width={88} />{id !== "chatters" && <small><Bar width={56} /></small>}</span>
                </span>
              </th>
              {columns.slice(1).map((label, index) => (
                <td className="num" key={label}><span className="mobile-cell-label">{label}</span><Bar width={index === 0 ? 44 : 24} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-expand skeleton-table-footer"><Bar width={62} /></div>
    </section>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-hidden="true">
      <dl className="panel metric-strip">
        {metrics.map(([label, note]) => (
          <div className="metric-cell" key={label}>
            <dt className="metric-label">{label}</dt>
            <dd className="metric-value"><Bar width={108} /></dd>
            <dd className="metric-note">{note}</dd>
          </div>
        ))}
      </dl>
      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <Heading title="Earnings over time" subtitle="Daily settled earnings after platform fees" meta="USD" />
          <div className="chart">
            <div className="chart-body">
              <div className="skeleton-chart-axis">{rows.map(row => <Bar key={row} width={32} />)}</div>
              <div className="chart-plot skeleton-chart-grid">{rows.map(row => <span key={row} />)}</div>
            </div>
            <div className="chart-days skeleton-chart-days">{rows.map(row => <Bar key={row} width={32} />)}</div>
            <p className="chart-readout">Select a day to see its net earnings.</p>
          </div>
        </section>
        <section className="panel mix-panel">
          <Heading title="Revenue mix" subtitle="Net earnings by transaction type" />
          <ul className="mix-list">
            {[0, 1, 2, 3, 4].map(row => (
              <li key={row}><div className="mix-label"><Bar width={76} /><Bar width={52} /></div><span className="mix-track skeleton-track" /></li>
            ))}
          </ul>
          <div className="mix-insight skeleton-insight"><Bar width={176} /></div>
        </section>
        <TableSkeleton id="creators" title="Creator performance" subtitle="Ranked by net earnings" columns={["Creator", "Net earnings", "New subs", "Active fans"]} avatar />
        <TableSkeleton id="promotions" title="Promotions" subtitle="Cumulative results for links created in this period" columns={["Link", "Clicks", "Subs / claims", "Net earnings"]} />
        <TableSkeleton id="chatters" title="Chatter performance" subtitle="Employee sales and messaging activity" columns={["Chatter", "Sales", "Messages", "Fan chats", "PPV unlock rate"]} avatar />
        <section id="audience" className="panel detail-panel">
          <Heading title="Audience" subtitle="New subscribers and end-of-period creator fan counts" />
          <div className="audience-strip">
            {["New subscribers", "Active fans"].map(label => <div key={label}><span>{label}</span><strong><Bar width={62} /></strong></div>)}
          </div>
          <ul className="audience-list">{rows.map(row => <li className="list-line" key={row}><Bar width={92} /><Bar width={35} /></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
