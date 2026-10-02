import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { requestPersistentStorage } from './lib/storage';
import './index.css';

requestPersistentStorage();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
