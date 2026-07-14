import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RestTimer } from './RestTimer';

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('RestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there is no rest period', () => {
    const { container } = render(<RestTimer seconds={0} onReset={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('counts down from the given seconds, one tick per second', () => {
    render(<RestTimer seconds={180} onReset={vi.fn()} />);
    expect(screen.getByText('Rest timer: 3:00')).toBeInTheDocument();

    advance(1000);
    expect(screen.getByText('Rest timer: 2:59')).toBeInTheDocument();

    advance(60_000);
    expect(screen.getByText('Rest timer: 1:59')).toBeInTheDocument();
  });

  it('pads single-digit seconds with a leading zero', () => {
    render(<RestTimer seconds={130} onReset={vi.fn()} />);
    advance(1000);
    expect(screen.getByText('Rest timer: 2:09')).toBeInTheDocument();
  });

  it('stops at zero and never goes negative', () => {
    render(<RestTimer seconds={2} onReset={vi.fn()} />);
    advance(1000);
    expect(screen.getByText('Rest timer: 0:01')).toBeInTheDocument();

    advance(1000);
    expect(screen.getByText('Rest timer: 0:00')).toBeInTheDocument();

    advance(3000);
    expect(screen.getByText('Rest timer: 0:00')).toBeInTheDocument();
  });

  it('pauses and resumes the countdown', () => {
    render(<RestTimer seconds={60} onReset={vi.fn()} />);

    act(() => {
      screen.getByRole('button', { name: 'Pause' }).click();
    });
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

    advance(5000);
    expect(screen.getByText('Rest timer: 1:00')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'Resume' }).click();
    });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    advance(1000);
    expect(screen.getByText('Rest timer: 0:59')).toBeInTheDocument();
  });

  it('reset notifies the parent and stops the countdown', () => {
    const onReset = vi.fn();
    render(<RestTimer seconds={60} onReset={onReset} />);

    act(() => {
      screen.getByRole('button', { name: 'Reset' }).click();
    });

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

    advance(5000);
    expect(screen.getByText('Rest timer: 1:00')).toBeInTheDocument();
  });

  it('announces the countdown politely for screen readers', () => {
    const { container } = render(<RestTimer seconds={60} onReset={vi.fn()} />);
    expect(container.querySelector('.rest-timer')).toHaveAttribute('aria-live', 'polite');
  });
});
