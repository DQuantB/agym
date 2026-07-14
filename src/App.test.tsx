import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { mockParser } from './parser/mockParser';
import { initializeAgymStore } from './state/store';
import { createInMemoryStorageAdapter } from './storage/inMemoryAdapter';

function renderApp() {
  initializeAgymStore({ adapter: createInMemoryStorageAdapter(), parser: mockParser });
  return render(<App />);
}

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on Workout and switches between the app tabs without a page reload', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByRole('heading', { name: /today’s workout/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(screen.getByRole('heading', { name: /stop re-explaining/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByRole('heading', { name: /canonical memory/i })).toBeInTheDocument();
    expect(screen.getByText(/no confirmed events yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Briefing' }));
    expect(screen.getByRole('heading', { name: /coach briefing/i })).toBeInTheDocument();
    expect(screen.getByText(/confirmed events: 0/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('heading', { name: /data ownership/i })).toBeInTheDocument();
    expect(screen.getAllByText(/private-alpha data is scoped/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(screen.getByRole('heading', { name: /stop re-explaining/i })).toBeInTheDocument();
  });
});
