import { type FormEvent, useState } from 'react';
import { getSupabaseClient, getSupabaseConfiguration } from '../lib/supabase';

const WORKFLOW_STEPS = [
  ['01', 'The planned week', 'The athlete starts with a plan, but life happens between sessions.'],
  ['02', 'The real week', 'Workouts, changes, recovery and notes arrive fragmented and in their own words.'],
  ['03', 'Confirmed context', 'The athlete reviews what was understood. Raw input stays preserved; uncertainty stays visible.'],
  ['04', 'A better starting point', 'A coach can review the confirmed plan-versus-actual context before deciding what to do next.'],
] as const;

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function CoachLandingPage() {
  const [email, setEmail] = useState('');
  const [coachName, setCoachName] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const configured = getSupabaseConfiguration() !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setState('submitting');
    setErrorMessage(null);

    const { error } = await getSupabaseClient().from('coach_leads').insert({
      email: trimmedEmail,
      coach_name: coachName.trim() || null,
      note: note.trim() || null,
    });

    if (error) {
      setState('error');
      setErrorMessage('Something went wrong submitting that — please try again in a moment.');
      return;
    }

    setState('success');
  }

  return (
    <main className="coach-landing">
      <header className="coach-landing-nav">
        <a className="coach-landing-mark" href="#top" aria-label="AGym landing page">AGYM</a>
        <p>PRIVATE EARLY ACCESS / COACHES</p>
        <a className="coach-landing-nav-link" href="#early-access">Become an early partner</a>
      </header>

      <section className="coach-landing-hero" id="top">
        <div className="coach-landing-hero-copy">
          <p className="coach-landing-eyebrow">THE GAP BETWEEN PLAN AND REALITY</p>
          <h1>Your client&rsquo;s plan is not their whole training week.</h1>
          <p className="coach-landing-lede">
            AGym is building a training-memory layer for the information that normally gets lost between check-ins:
            completed sessions, changes, missed work, recovery and the notes clients send in their own words.
          </p>
          <p className="coach-landing-qualification">
            For independent online strength and hypertrophy coaches who want a clearer starting point before they
            make the next coaching decision.
          </p>
          <div className="coach-landing-actions">
            <a className="coach-landing-primary" href="#early-access">Become an early partner <span aria-hidden="true">↓</span></a>
            <a className="coach-landing-secondary" href="#workflow">See the workflow <span aria-hidden="true">→</span></a>
          </div>
          <p className="coach-landing-small">Early concept. Built to support coach judgement — never replace it.</p>
        </div>

        <div className="coach-landing-signal" aria-label="Illustrative plan to confirmed-context flow">
          <div className="signal-label">PLAN / ACTUAL / CONTEXT</div>
          <div className="signal-plan">
            <span>MON</span><strong>Upper A · 4 sets</strong><em>planned</em>
          </div>
          <div className="signal-fragments">
            <p>“travelled — did 2 sets”</p>
            <p>“sleep was poor”</p>
            <p>“shoulder felt off”</p>
          </div>
          <div className="signal-arrow" aria-hidden="true">↓</div>
          <div className="signal-context">
            <span>CONFIRMED CONTEXT</span>
            <strong>Upper A / modified</strong>
            <p>2 of 4 sets completed · recovery note retained</p>
          </div>
          <p className="signal-caption">Illustrative workflow — reviewable, not automated coaching.</p>
        </div>
      </section>

      <section className="coach-landing-reason" aria-labelledby="why-agym">
        <p className="coach-landing-eyebrow">WHY THIS EXISTS</p>
        <h2 id="why-agym">The client update is often the hardest part of the check-in.</h2>
        <div className="coach-landing-reason-grid">
          <article>
            <span>BEFORE</span>
            <p>Plan in one place. Training details in an app. Recovery notes in messages. The coach has to reconstruct the week.</p>
          </article>
          <article>
            <span>THE HYPOTHESIS</span>
            <p>When the athlete can preserve and confirm what actually happened, the conversation can start from shared context.</p>
          </article>
          <article>
            <span>THE BOUNDARY</span>
            <p>AGym does not prescribe, diagnose, change a plan, or decide for the coach. Professional judgement stays with you.</p>
          </article>
        </div>
      </section>

      <section className="coach-landing-section" id="workflow" aria-labelledby="coach-landing-workflow">
        <div className="coach-landing-section-heading">
          <p className="coach-landing-eyebrow">THE PROTOTYPE WORKFLOW</p>
          <h2 id="coach-landing-workflow">A clearer record of the week before the next decision.</h2>
          <p>Every stage below is a prototype concept. The important part is the direction: raw evidence stays raw, and a guess should still look like a guess.</p>
        </div>
        <ol className="coach-landing-steps">
          {WORKFLOW_STEPS.map(([number, title, description]) => (
            <li key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="coach-landing-partner" id="early-access" aria-labelledby="coach-landing-signup">
        <div>
          <p className="coach-landing-eyebrow">PRIVATE EARLY ACCESS</p>
          <h2 id="coach-landing-signup">Help shape what a useful training record should look like.</h2>
          <p>
            We are inviting a small number of independent coaches to react to the concept before expanding it.
            You will see the direction early, tell us what is missing, and be first in line when there is a concrete
            private beta to test.
          </p>
          <ul>
            <li>No request to share client data.</li>
            <li>No posting or promotion requirement.</li>
            <li>No claim that you are endorsing AGym.</li>
          </ul>
        </div>

        <div className="coach-landing-form-card">
          {!configured && (
            <p role="status" className="coach-landing-dm-cta">
              <strong>Interested?</strong> If you reached this page through Instagram, reply <strong>BETA</strong> to
              the message or send AGym a DM. We will share the next step personally.
            </p>
          )}

          {configured && state === 'success' && (
            <p role="status" className="coach-landing-success">You&rsquo;re on the list. We&rsquo;ll reach out personally when there&rsquo;s something concrete to react to.</p>
          )}

          {configured && state !== 'success' && (
            <form onSubmit={handleSubmit} className="coach-landing-form">
              <label htmlFor="coach-email">Email address</label>
              <input id="coach-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />

              <label htmlFor="coach-name">Name (optional)</label>
              <input id="coach-name" type="text" autoComplete="name" value={coachName} onChange={(event) => setCoachName(event.target.value)} />

              <label htmlFor="coach-note">What would make this useful in your current check-in process? (optional)</label>
              <textarea id="coach-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />

              <button type="submit" className="primary" disabled={state === 'submitting'}>
                {state === 'submitting' ? 'Submitting…' : 'Request early access'}
              </button>
              {state === 'error' && errorMessage && <p role="alert" className="microcopy">{errorMessage}</p>}
              <p className="coach-landing-consent">By submitting, you agree AGym can email you about early access. We do not sell your data; ask us to remove it at any time.</p>
            </form>
          )}
        </div>
      </section>

      <footer className="coach-landing-footer">
        <p>AGym is not a medical device and does not provide medical, nutrition or clinical advice.</p>
        <p>Designed around user-controlled records, visible uncertainty and coach-led decisions.</p>
      </footer>
    </main>
  );
}
