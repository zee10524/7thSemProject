import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { errorMessage } from '../api/http';
import { ErrorState, PageHead, Section, SectionHead, Spinner } from '../components/atoms';
import { toast } from '../store/ui';

interface ModelRow {
  id: string;
  name: string;
  mode: string | null;
  metrics: Record<string, number | null>;
}

const fmt = (v: unknown) => (typeof v === 'number' ? v.toFixed(4) : 'n/a');

export default function AdminPage() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: api.adminOverview });
  const metrics = useQuery({ queryKey: ['admin', 'metrics'], queryFn: api.adminMetrics });
  const reseed = useMutation({
    mutationFn: () => api.adminReseed(false),
    onSuccess: (r) => {
      toast(`Catalogue reseeded: ${r.upserted} books from ${r.source}`);
      void qc.invalidateQueries();
    },
    onError: (err) => toast(errorMessage(err), { kind: 'warn' }),
  });

  const rows = (metrics.data?.models as ModelRow[] | undefined) ?? [];
  const metricNames = [...new Set(rows.flatMap((r) => Object.keys(r.metrics ?? {})))];

  return (
    <div className="page page--admin">
      <PageHead
        eyebrow="Admin"
        title="Behind the page"
        sub="Service health and the offline evaluation report. Null metrics show as n/a, never as zero."
      />
      <Section cls="admin" id="sec-overview">
        <SectionHead no="01" title="Overview" />
        {overview.isPending ? (
          <Spinner />
        ) : overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        ) : (
          <>
            <dl className="stats">
              {(
                [
                  ['Readers', overview.data.users],
                  ['Books', overview.data.books],
                  ['Ratings', overview.data.ratings],
                  ['Reviews', overview.data.reviews],
                  ['Conversations', overview.data.chatSessions],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="stat">
                  <dt className="stat__label">{k}</dt>
                  <dd className="stat__value">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="settings__grid admin__grid">
              <div className="aside__block">
                <h3 className="aside__title">Model service</h3>
                <p>
                  Mode <strong>{overview.data.modelMode}</strong>, circuit breaker{' '}
                  <strong>{overview.data.breaker.state}</strong> ({overview.data.breaker.failures} recent
                  failures)
                </p>
                <pre className="admin__json">
                  {JSON.stringify(overview.data.modelHealth, null, 2) ?? 'unreachable'}
                </pre>
              </div>
              <div className="aside__block">
                <h3 className="aside__title">Catalogue</h3>
                <p className="muted">
                  Re-import books from the model service catalogue (same source; reader data is kept).
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={reseed.isPending}
                  onClick={() => reseed.mutate()}
                >
                  {reseed.isPending ? 'Reseeding' : 'Reseed catalogue'}
                </button>
              </div>
            </div>
          </>
        )}
      </Section>
      <Section cls="admin" id="sec-metrics">
        <SectionHead
          no="02"
          title="Evaluation"
          sub={metrics.data?.is_mock ? 'The mock model service has no results yet.' : undefined}
        />
        {metrics.isPending ? (
          <Spinner />
        ) : metrics.isError ? (
          <ErrorState error={metrics.error} onRetry={() => void metrics.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  <th scope="col">Id</th>
                  <th scope="col">Model</th>
                  {metricNames.map((m) => (
                    <th key={m} scope="col">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.name}</td>
                    {metricNames.map((m) => (
                      <td key={m}>{fmt(r.metrics?.[m])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
