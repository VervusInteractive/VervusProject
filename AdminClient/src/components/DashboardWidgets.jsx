function MetricGrid({ metrics = [] }) {
  if (!metrics.length) {
    return null;
  }

  return (
    <section className="dashboard-grid" aria-label="Key metrics">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <em>{metric.delta}</em>
        </article>
      ))}
    </section>
  );
}

function PlaceholderChart({ title, bars }) {
  if (!bars?.length) {
    return null;
  }

  return (
    <section className="dashboard-panel chart-panel">
      <div>
        <p className="eyebrow">Placeholder chart</p>
        <h2>{title}</h2>
        <p>Mock chart styling is ready for wiring into live analytics data.</p>
      </div>
      <div className="bar-chart" aria-label={title}>
        {bars.map((height, index) => (
          <span key={`${title}-${index}`} style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  );
}

function FunnelPanel({ funnel }) {
  if (!funnel?.length) {
    return null;
  }

  return (
    <section className="dashboard-panel funnel-panel">
      <div>
        <p className="eyebrow">Placeholder funnel</p>
        <h2>Visitor to purchase path</h2>
        <p>Each stage is represented with mock counts and relative width.</p>
      </div>
      <div className="funnel-list">
        {funnel.map((stage) => (
          <div className="funnel-stage" key={stage.label}>
            <div>
              <strong>{stage.label}</strong>
              <span>{stage.value}</span>
            </div>
            <i style={{ width: `${stage.percent}%` }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelinePanel({ timeline }) {
  if (!timeline?.length) {
    return null;
  }

  return (
    <section className="dashboard-panel timeline-panel">
      <div>
        <p className="eyebrow">Audit trail</p>
        <h2>Room event stream</h2>
        <p>Placeholder timeline for room joins, leaves, starts, ends, and host changes.</p>
      </div>
      <ol className="timeline-list">
        {timeline.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function EmptyPanel({ title, message }) {
  return (
    <section className="table-panel empty-panel">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

function DataTable({ title, columns = [], rows = [] }) {
  if (!columns.length || !rows.length) {
    return null;
  }

  return (
    <section className="table-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.join("-")}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export { DataTable, EmptyPanel, FunnelPanel, MetricGrid, PlaceholderChart, TimelinePanel };
