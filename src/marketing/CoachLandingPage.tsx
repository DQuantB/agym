import { type FormEvent, useState } from 'react';
import { getSupabaseClient, getSupabaseConfiguration } from '../lib/supabase';

const WORKFLOW_STEPS = [
  'A coach receives three messy client updates through their existing channels.',
  'Each original message is preserved; a reviewable summary makes uncertainty visible.',
  'The coach reviews a concise client briefing showing reported plan-vs-actual context.',
  'The coach may paste or export that context to their own LLM for preparation.',
  'The coach — not AGym or the LLM — decides the next plan and talks to the client.',
];

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
      <header className="coach-landing-hero">
        <div className="poster-word">AGYM</div>
        <p className="coach-landing-eyebrow">For independent coaches — early concept, not a live product</p>
        <h1>Stop reconstructing your clients&rsquo; week from scratch every check-in.</h1>
        <p className="coach-landing-lede">
          AGym is exploring a reviewable context layer between a client&rsquo;s messy self-report and your own
          coaching workflow — so you spend less time piecing a week together and more time deciding what to do
          about it. You keep full professional judgment; AGym does not coach, prescribe, or decide anything.
        </p>
      </header>

      <section className="coach-landing-section" aria-labelledby="coach-landing-problem">
        <h2 id="coach-landing-problem">The problem we&rsquo;re validating</h2>
        <p>
          If you run online strength or hypertrophy coaching with recurring client check-ins across text, voice
          notes, forms, or spreadsheets, a real week often arrives fragmented — and has to be manually
          reconstructed before you can decide whether to change a plan. We think that reconstruction work is
          costly and repeated. This is a hypothesis we&rsquo;re actively testing with coaches, not a proven claim.
        </p>
      </section>

      <section className="coach-landing-section" aria-labelledby="coach-landing-workflow">
        <h2 id="coach-landing-workflow">A prototype concept — not a built feature</h2>
        <ol className="coach-landing-steps">
          {WORKFLOW_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="coach-landing-disclaimer">
          Every step above is a labeled prototype concept. Nothing described here is live yet, and nothing here
          implies real-time monitoring, a coach dashboard, automated plan changes, or medical/nutrition advice.
        </p>
      </section>

      <section className="coach-landing-section" aria-labelledby="coach-landing-signup">
        <h2 id="coach-landing-signup">Get early access</h2>
        <p>
          We&rsquo;re talking to a small number of coaches before building anything further. Leave your email and
          we&rsquo;ll reach out when there&rsquo;s something concrete to react to — no spam, no automated
          onboarding.
        </p>

        {!configured && (
          <p role="status" className="microcopy">Sign-up is temporarily unavailable. Please check back shortly.</p>
        )}

        {configured && state === 'success' && (
          <p role="status" className="coach-landing-success">Thanks — we&rsquo;ll be in touch.</p>
        )}

        {configured && state !== 'success' && (
          <form onSubmit={handleSubmit} className="coach-landing-form">
            <label htmlFor="coach-email">Email address</label>
            <input
              id="coach-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="coach-name">Name (optional)</label>
            <input
              id="coach-name"
              type="text"
              autoComplete="name"
              value={coachName}
              onChange={(event) => setCoachName(event.target.value)}
            />

            <label htmlFor="coach-note">What does your check-in process look like today? (optional)</label>
            <textarea
              id="coach-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            <button type="submit" className="primary" disabled={state === 'submitting'}>
              {state === 'submitting' ? 'Submitting…' : 'Get early access'}
            </button>

            {state === 'error' && errorMessage && <p role="alert" className="microcopy">{errorMessage}</p>}

            <p className="coach-landing-consent">
              By submitting, you agree AGym can email you about early access to this project. We don&rsquo;t sell
              your data. Email us any time to be removed.
            </p>
          </form>
        )}
      </section>

      <footer className="coach-landing-footer">
        <p>AGym is not a medical device and does not provide medical, nutrition, or clinical advice.</p>
        <p>You remain responsible for your coaching decisions. AGym does not contact or message your clients.</p>
      </footer>
    </main>
  );
}
