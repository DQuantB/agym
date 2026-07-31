import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TodayScreen from '../TodayScreen';
import { useAuth } from '../lib/AuthProvider';
import { getSupabaseClient } from '../lib/supabase';

jest.mock('../lib/AuthProvider');
jest.mock('../lib/supabase');

test('renders loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({ loading: true, user: null });
    render(<TodayScreen />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
});

test('renders signed out state', () => {
    (useAuth as jest.Mock).mockReturnValue({ loading: false, user: null });
    render(<TodayScreen />);
    expect(screen.getByText(/signed out/i)).toBeTruthy();
});

test('renders error state', () => {
    (useAuth as jest.Mock).mockReturnValue({ loading: false, user: { id: '1' } });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ is: jest.fn().mockReturnValue({ order: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ maybeSingle: jest.fn().mockResolvedValue({ error: { message: 'Error loading data' } } }) }) }) }) }) }) });
    render(<TodayScreen />);
    expect(screen.getByText(/error loading data/i)).toBeTruthy();
});

// Additional tests for each state can be added here
