import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthGate } from './auth/AuthGate';
import './app.css';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
  </React.StrictMode>,
);
