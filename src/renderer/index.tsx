import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './components/App';
import { MainProcessProvider } from './context/MainProcessContext';
import './styles/global.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <MainProcessProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </MainProcessProvider>
  </React.StrictMode>
);
