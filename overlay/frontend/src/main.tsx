import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DialogProvider } from './components/Dialog';
import { ToastProvider } from './components/Toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <DialogProvider>
        <App/>
      </DialogProvider>
    </ToastProvider>
  </StrictMode>,
);
