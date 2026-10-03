import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { requestPersistentStorage } from './lib/storage';
import { saveDefaultWeightUnitIfMissing } from './lib/savedData';
import './index.css';

requestPersistentStorage();
saveDefaultWeightUnitIfMissing();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
