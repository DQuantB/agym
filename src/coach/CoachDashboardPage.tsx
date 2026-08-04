import { useEffect, useState } from 'react';
import { getSupabaseClient, getSupabaseConfiguration } from '../lib/supabase';
import {
  generateCoachCode,
  loadClientEvents,
  loadClientPlans,
  loadMyClients,
  loadMyCoachCodes,
  loadMyCoachProfile,
  type ClientEvent,
  type ClientPlan,
  type CoachClient,
  type CoachCode,
  type CoachProfile,
} from './coachApi';

type LoadState = 'loading' | 'not_a_coach' | 'ready' | 'error';

export function CoachDashboardPage() {
  const configured = getSupabaseConfiguration() !== null;
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [codes, setCodes] = useState<CoachCode[]>([]);
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CoachClient | null>(null);
  const [clientPlans, setClientPlans] = useState<ClientPlan[]>([]);
  const [clientEvents, setClientEvents] = useState<ClientEvent[]>([]);
  const [clientDataLoading, setClientDataLoading] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const client = getSupabaseClient();
    void loadMyCoachProfile(client)
      .then((found) => {
        if (!found) { setState('not_a_coach'); return; }
        setProfile(found);
        return Promise.all([loadMyCoachCodes(client), loadMyClients(client)]).then(([loadedCodes, loadedClients]) => {
          setCodes(loadedCodes);
          setClients(loadedClients);
          setState('ready');
        });
      })
      .catch((error: unknown) => { setErrorMessage(error instanceof Error ? error.message : 'Could not load your coach dashboard.'); setState('error'); });
  }, [configured]);

  function handleGenerateCode() {
    const client = getSupabaseClient();
    setGenerating(true);
    void generateCoachCode(client)
      .then((code) => setCodes((existing) => [code, ...existing]))
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Could not generate a coach code.'))
      .finally(() => setGenerating(false));
  }

  function openClient(coachClient: CoachClient) {
    setSelectedClient(coachClient);
    setClientDataLoading(true);
    const client = getSupabaseClient();
    void Promise.all([loadClientPlans(client, coachClient.clientId), loadClientEvents(client, coachClient.clientId)])
      .then(([plans, events]) => { setClientPlans(plans); setClientEvents(events); })
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : "Could not load this client's data."))
      .finally(() => setClientDataLoading(false));
  }

  if (!configured) return <main className="coach-dash"><p className="microcopy">Coach dashboard is unavailable — Supabase is not configured.</p></main>;
  if (state === 'loading') return <main className="coach-dash"><p className="microcopy">Loading your coach dashboard…</p></main>;
  if (state === 'error') return <main className="coach-dash"><p role="alert" className="coach-dash-error">{errorMessage}</p></main>;
  if (state === 'not_a_coach') {
    return (
      <main className="coach-dash">
        <div className="poster-word">AGYM</div>
        <p className="microcopy">This account is not set up as a coach. Coach accounts are set up by the AGym founder for now.</p>
      </main>
    );
  }

  return (
    <main className="coach-dash">
      <header className="coach-dash-header">
        <div className="poster-word">AGYM</div>
        <h1>Coach dashboard — {profile?.displayName}</h1>
        <p className="microcopy">You can see confirmed training history and accepted plans for clients who have linked to you with a coach code. Raw, unconfirmed logs are never shown here.</p>
      </header>

      {errorMessage ? <p role="alert" className="coach-dash-error">{errorMessage}</p> : null}

      <section className="coach-dash-section" aria-labelledby="coach-dash-codes">
        <h2 id="coach-dash-codes">Your coach codes</h2>
        <button type="button" className="primary" disabled={generating} onClick={handleGenerateCode}>
          {generating ? 'Generating…' : 'Generate a new code'}
        </button>
        {codes.length === 0 ? <p className="microcopy">No codes yet. Generate one and share it with a client.</p> : (
          <ul className="coach-dash-code-list">
            {codes.map((code) => (
              <li key={code.id}>
                <code>{code.code}</code>
                <span className="microcopy">
                  {' '}— {code.active ? 'active' : 'inactive'}
                  {code.requiresPayment ? ' · requires payment (not yet supported)' : ' · free'}
                  {' '}· used {code.useCount}{code.maxUses ? `/${code.maxUses}` : ''} times
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="coach-dash-section" aria-labelledby="coach-dash-roster">
        <h2 id="coach-dash-roster">Your clients ({clients.length})</h2>
        {clients.length === 0 ? <p className="microcopy">No clients have linked to you yet.</p> : (
          <ul className="coach-dash-roster">
            {clients.map((coachClient) => (
              <li key={coachClient.linkId}>
                <button type="button" className="coach-dash-client-row" onClick={() => openClient(coachClient)}>
                  {coachClient.displayName} <span className="microcopy">— linked {new Date(coachClient.linkedAt).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedClient ? (
        <section className="coach-dash-section" aria-labelledby="coach-dash-client-detail">
          <h2 id="coach-dash-client-detail">{selectedClient.displayName}</h2>
          {clientDataLoading ? <p className="microcopy">Loading…</p> : (
            <>
              <h3>Accepted plans</h3>
              {clientPlans.length === 0 ? <p className="microcopy">No plans yet.</p> : (
                <ul>{clientPlans.map((plan) => <li key={plan.id}>{plan.title} — {plan.status}{plan.scheduledFor ? ` · ${plan.scheduledFor}` : ''}</li>)}</ul>
              )}
              <h3>Confirmed outcomes</h3>
              {clientEvents.length === 0 ? <p className="microcopy">No confirmed outcomes yet.</p> : (
                <ul>{clientEvents.map((event) => <li key={event.id}>{event.eventType} — confirmed {new Date(event.confirmedAt).toLocaleString()}</li>)}</ul>
              )}
            </>
          )}
        </section>
      ) : null}

      <footer className="microcopy">AGym is not a medical device. This dashboard shows only what a client explicitly linked to you, and never raw or unconfirmed input.</footer>
    </main>
  );
}
