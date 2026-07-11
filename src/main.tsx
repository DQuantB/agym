import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app.css';
import { mockParser } from './parser/mockParser';
import { initializeAgymStore } from './state/store';
import { localStorageAdapter } from './storage/localStorageAdapter';

initializeAgymStore({ adapter: localStorageAdapter, parser: mockParser });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
