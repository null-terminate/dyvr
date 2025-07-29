import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import Dashboard from '../pages/Dashboard';
import ProjectList from '../pages/ProjectList';
import ProjectDetail from '../pages/ProjectDetail';
import Settings from '../pages/Settings';

const App: React.FC = () => {
  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <Sidebar />
        <div className="content-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default App;
