import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
  return (
    <div className="sidebar">
      <nav>
        <ul style={{ listStyle: 'none', padding: '10px' }}>
          <li style={{ marginBottom: '10px' }}>
            <NavLink 
              to="/" 
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px',
                backgroundColor: isActive ? '#3498db' : 'transparent',
                color: isActive ? 'white' : '#333',
                textDecoration: 'none',
                borderRadius: '4px'
              })}
              end
            >
              Dashboard
            </NavLink>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <NavLink 
              to="/projects" 
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px',
                backgroundColor: isActive ? '#3498db' : 'transparent',
                color: isActive ? 'white' : '#333',
                textDecoration: 'none',
                borderRadius: '4px'
              })}
            >
              Projects
            </NavLink>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <NavLink 
              to="/settings" 
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px',
                backgroundColor: isActive ? '#3498db' : 'transparent',
                color: isActive ? 'white' : '#333',
                textDecoration: 'none',
                borderRadius: '4px'
              })}
            >
              Settings
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
