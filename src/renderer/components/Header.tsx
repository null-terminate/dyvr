import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="logo">
        <h1>Project Manager</h1>
      </div>
      <div className="header-actions">
        <button onClick={() => navigate('/settings')}>Settings</button>
      </div>
    </header>
  );
};

export default Header;
