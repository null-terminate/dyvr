import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useElectron } from '../context/ElectronContext';

interface Project {
  id: string;
  name: string;
}

const Sidebar: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const api = useElectron();
  const location = useLocation();
  
  // Automatically expand projects when on a project-related page
  useEffect(() => {
    if (location.pathname.includes('/projects')) {
      setIsProjectsExpanded(true);
    }
  }, [location.pathname]);

  // Load projects from the Electron API
  useEffect(() => {
    if (api) {
      // Set up event listener for projects loaded
      api.onProjectsLoaded((loadedProjects) => {
        setProjects(loadedProjects);
      });
      
      // Request projects to be loaded
      api.loadProjects();
      
      // Clean up event listener
      return () => {
        api.removeAllListeners('projects-loaded');
      };
    } else {
      // Mock data for development without Electron
      setProjects([
        { id: '1', name: 'Project Alpha' },
        { id: '2', name: 'Project Beta' },
        { id: '3', name: 'Project Gamma' },
        { id: '4', name: 'Project Delta' }
      ]);
      
      // Return empty cleanup function for non-Electron environment
      return () => {};
    }
  }, [api]);

  // Common link style function
  const getLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'block',
    padding: '6px 8px',
    backgroundColor: isActive ? '#3498db' : 'transparent',
    color: isActive ? 'white' : '#333',
    textDecoration: 'none',
    borderRadius: '3px'
  });

  // Project link style function
  const getProjectLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'block',
    padding: '4px 8px 4px 12px',
    backgroundColor: isActive ? '#3498db' : 'transparent',
    color: isActive ? 'white' : '#555',
    textDecoration: 'none',
    borderRadius: '3px',
    fontSize: '0.9em'
  });

  return (
    <div className="sidebar">
      <nav>
        <ul style={{ listStyle: 'none', padding: '5px' }}>
          <li style={{ marginBottom: '3px' }}>
            <NavLink to="/" style={getLinkStyle} end>
              Dashboard
            </NavLink>
          </li>
          <li style={{ marginBottom: '3px' }}>
            <div>
              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  backgroundColor: location.pathname === '/projects' ? '#3498db' : 'transparent',
                  color: location.pathname === '/projects' ? 'white' : '#333',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
              >
                <NavLink 
                  to="/projects" 
                  style={getLinkStyle}
                  onClick={(e) => e.stopPropagation()}
                >
                  Projects
                </NavLink>
                <span style={{ marginRight: '5px' }}>
                  {isProjectsExpanded ? '▼' : '►'}
                </span>
              </div>
              
              {isProjectsExpanded && (
                <ul style={{ 
                  listStyle: 'none', 
                  padding: '0 0 0 6px', 
                  margin: '0',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {projects.map(project => (
                    <li key={project.id} style={{ marginBottom: '2px' }}>
                      <NavLink 
                        to={`/projects/${project.id}`} 
                        style={getProjectLinkStyle}
                      >
                        {project.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
          <li style={{ marginBottom: '3px' }}>
            <NavLink to="/settings" style={getLinkStyle}>
              Settings
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
