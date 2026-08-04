import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthGate } from './auth/AuthGate';
import './app.css';
import { CoachDashboardPage } from './coach/CoachDashboardPage';
import { getSupabaseClient, getSupabaseConfiguration } from './lib/supabase';
import { mockParser } from './parser/mockParser';
import { initializeAgymStore } from './state/store';
import { localStorageAdapter } from './storage/localStorageAdapter';
import { createSupabaseStorageAdapter } from './storage/supabaseStorageAdapter';

// The local adapter remains only for unconfigured development/test environments.
// A configured private alpha always uses the authenticated, RLS-protected adapter.
const adapter = getSupabaseConfiguration()
  ? createSupabaseStorageAdapter(getSupabaseClient())
  : localStorageAdapter;

initializeAgymStore({ adapter, parser: mockParser });

// The coach dashboard is its own authenticated route rather than a tab inside
// the client-facing app -- a coach viewing their roster should never share a
// render tree/cache with the client data store initialized above.
const root = window.location.pathname === '/coach'
  ? <AuthGate><CoachDashboardPage /></AuthGate>
  : <AuthGate><App /></AuthGate>;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{root}</React.StrictMode>,
);
