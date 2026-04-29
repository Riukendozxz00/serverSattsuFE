import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const ENDPOINT = 'http://localhost:3000/radialStatus/disponibilidad';

function formatRange(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    year: 'numeric',
  });
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return `${formatter.format(firstDay)} - ${formatter.format(date)}`;
}

function parseDate(value) {
  return new Date(value.replace(' ', 'T'));
}

function groupByApp(records) {
  const groups = new Map();

  for (const record of records) {
    const appId = record.appId ?? record.appName ?? 'unknown';

    if (!groups.has(appId)) {
      groups.set(appId, []);
    }
    groups.get(appId).push(record);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([appId, checks]) => ({
      appId,
      name: checks.find((check) => check.appName)?.appName || `App ${appId}`,
      checks: checks.sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha)),
    }));
}

function getUptime(checks) {
  if (!checks.length) return '0.00';
  const available = checks.filter((check) => check.status).length;
  return ((available / checks.length) * 100).toFixed(2);
}

function getLatestStatus(checks) {
  return checks.at(-1)?.status ?? false;
}

function StatusIcon({ active = true }) {
  return (
    <span className={`status-icon ${active ? 'status-icon-ok' : 'status-icon-down'}`}>
      {active ? '✓' : '!'}
    </span>
  );
}

function AppRow({ app }) {
  const latestStatus = getLatestStatus(app.checks);
  const uptime = getUptime(app.checks);
  const bars = app.checks.length ? app.checks : [{ status: false, fecha: '' }];

  return (
    <section className="app-row">
      <div className="app-row-header">
        <div className="app-title">
          <StatusIcon active={latestStatus} />
          <strong>{app.name}</strong>
          <span className="info-dot">i</span>
          <span className="muted">{app.checks.length} checks</span>
        </div>
        <span className="uptime">{uptime}% uptime</span>
      </div>

      <div className="bar-track" aria-label={`Histórico de disponibilidad de ${app.name}`}>
        {bars.map((check, index) => (
          <span
            key={`${check.fecha}-${index}`}
            className={`bar ${check.status ? 'bar-ok' : 'bar-down'}`}
            title={check.fecha ? `${check.fecha} - ${check.status ? 'Disponible' : 'No disponible'}` : 'Sin datos'}
          />
        ))}
      </div>
    </section>
  );
}

function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadAvailability() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(ENDPOINT);
        if (!response.ok) {
          throw new Error('Error Server');
        }

        const data = await response.json();
        if (mounted) {
          setRecords(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'No se pudo consultar la disponibilidad');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAvailability();
    const interval = window.setInterval(loadAvailability, 60000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const apps = useMemo(() => groupByApp(records), [records]);
  const fullyOperational = apps.length > 0 && apps.every((app) => getLatestStatus(app.checks));

  return (
    <main className="page-shell">
      <header className="topbar">
        <h1>Sattsu Status</h1>
        <button className="subscribe-button" type="button">Subscribe to updates</button>
      </header>

      <section className={`hero-status ${fullyOperational ? 'hero-ok' : 'hero-alert'}`}>
        <div className="hero-heading">
          <StatusIcon active={fullyOperational} />
          <h2>{fullyOperational ? 'Todos los sistemas operan correctamente' : 'Hay servicios con incidencias'}</h2>
        </div>
        <p>
          {error
            ? error
            : fullyOperational
              ? 'No se detectan problemas que afecten los servicios monitoreados.'
              : 'Uno o más servicios reportan indisponibilidad en el último check.'}
        </p>
      </section>

      <section className="status-panel">
        <div className="panel-header">
          <h2>System status</h2>
          <div className="date-switcher">
            <span aria-hidden="true">‹</span>
            <span>{formatRange()}</span>
            <span aria-hidden="true">›</span>
          </div>
        </div>

        {loading && <div className="empty-state">Consultando disponibilidad...</div>}

        {!loading && error && (
          <div className="empty-state error-state">
            No se pudo cargar el histórico. Verifica que el backend esté disponible en el puerto 3000.
          </div>
        )}

        {!loading && !error && apps.length === 0 && (
          <div className="empty-state">No hay registros de disponibilidad para este mes.</div>
        )}

        {!loading && !error && apps.map((app) => <AppRow key={app.appId} app={app} />)}
      </section>

      <button className="history-button" type="button">
        <span className="calendar-icon" aria-hidden="true" />
        View history
      </button>

      <footer className="powered-footer">
        <div className="powered-brand">
          <span>Powered by</span>
          <span className="powered-logo" aria-label="Digital Strategy" />
        </div>
        <p className="availability-note">
          Availability metrics are reported at an aggregate level across all tiers, models and error types. Individual
          customer availability may vary depending on their subscription tier as well as the specific model and API
          features in use.
        </p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
