import React from 'react';
import { useNavigate } from 'react-router-dom';
import gearIcon from '../../assets/Gear.png';

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="logo">
        <h1 style={{ fontSize: '1.5rem', margin: '0' }}>Digr</h1>
      </div>
      <div className="header-actions">
        <button 
          onClick={() => navigate('/settings')} 
          className="settings"
          title="Settings"
          style={{ 
            padding: '4px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Gear Icon Image */}
          <img 
            src={gearIcon} 
            alt="Settings" 
            style={{ 
              width: '24px', 
              height: '24px',
            }} 
          />
        </button>
      </div>
    </header>
  );
};

export default Header;
