import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMainProcess } from '../context/MainProcessContext';

interface Project {
  id: string;
  name: string;
}

const MIN_SIDEBAR_WIDTH = 200; // Minimum width in pixels
const DEFAULT_SIDEBAR_WIDTH = 250; // Default width in pixels

const Sidebar: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  // Refs to track initial positions during resize
  const initialMouseXRef = useRef<number>(0);
  const initialSidebarWidthRef = useRef<number>(DEFAULT_SIDEBAR_WIDTH);
  const api = useMainProcess();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Handle mouse events for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;
      
      // Calculate width change based on mouse movement
      const deltaX = e.clientX - initialMouseXRef.current;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, initialSidebarWidthRef.current + deltaX);
      
      // Directly update DOM for smoother resizing
      sidebarRef.current.style.width = `${newWidth}px`;
    };
    
    const handleMouseUp = () => {
      if (isResizing && sidebarRef.current) {
        // Update React state only when resize is complete
        const currentWidth = sidebarRef.current.offsetWidth;
        setSidebarWidth(currentWidth);
        setIsResizing(false);
      }
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Add a class or style to indicate resizing is happening
      if (sidebarRef.current) {
        sidebarRef.current.style.transition = 'none'; // Disable transition during resize
      }
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Re-enable transition when cleanup
      if (sidebarRef.current) {
        sidebarRef.current.style.transition = 'width 0.3s ease';
      }
    };
  }, [isResizing]);
  
  // Start resizing
  const startResizing = (e: React.MouseEvent) => {
    // Store initial mouse position and sidebar width
    initialMouseXRef.current = e.clientX;
    initialSidebarWidthRef.current = sidebarWidth;
    setIsResizing(true);
  };
  
  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };
  
  // Automatically expand projects when on a project-related page
  useEffect(() => {
    if (location.pathname.includes('/projects')) {
      setIsProjectsExpanded(true);
    }
  }, [location.pathname]);

  // Load projects from the Electron API
  useEffect(() => {
    if (!api) {
      // Set empty projects array when API is not available
      setProjects([]);
      return () => {};
    }
    
    console.log('Setting up event listeners in Sidebar');
    
    // Set up event listener for projects loaded
    const handleProjectsLoaded = (loadedProjects: Project[]) => {
      console.log('Projects loaded in Sidebar:', loadedProjects.length);
      setProjects(loadedProjects);
    };
    api.onProjectsLoaded(handleProjectsLoaded);
    
    // Set up event listener for when a project is created
    api.onProjectCreated((project: Project) => {
      // Refresh the project list
      api.loadProjects();
      
      // Ensure the projects list is expanded
      setIsProjectsExpanded(true);
    });
    
    // Set up event listener for when a project is deleted
    const handleProjectDeleted = (projectId: string) => {
      console.log('Project deleted event received in sidebar:', projectId);
      
      // Refresh the project list
      api.loadProjects();
      
      // If we're currently on the deleted project's page, navigate back to projects list
      if (location.pathname === `/projects/${projectId}`) {
        navigate('/projects');
      }
    };
    
    api.onProjectDeleted(handleProjectDeleted);
    
    // Request projects to be loaded
    api.loadProjects();
    
    // Clean up event listeners
    return () => {
      console.log('Cleaning up event listeners in Sidebar');
      if (api.removeAllListeners) {
        api.removeAllListeners('projects-loaded');
        api.removeAllListeners('project-created');
        api.removeAllListeners('project-deleted');
      }
    };
  }, [api, location.pathname, navigate]);

  // Common link style function
  const getLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'block',
    padding: '6px 8px',
    backgroundColor: isActive ? '#3498db' : 'transparent',
    color: isActive ? 'white' : '#333',
    textDecoration: 'none',
    borderRadius: '3px',
    fontWeight: 'bold'
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
    <div style={{ display: 'flex' }}>
      {/* Toggle Button (always visible) */}
      <div 
        style={{
          width: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          cursor: 'pointer',
          borderRight: '1px solid #ddd'
        }}
        onClick={toggleSidebar}
        title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
      >
        {isSidebarVisible ? '◀' : '▶'}
      </div>
      
      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className="sidebar"
        style={{
          width: isSidebarVisible ? `${sidebarWidth}px` : '0',
          overflow: 'hidden',
          transition: isResizing ? 'none' : 'width 0.3s ease',
          position: 'relative',
          backgroundColor: '#f8f8f8',
          borderRight: isResizing ? '1px solid #3498db' : '1px solid #ddd'
        }}
      >
        <nav style={{ display: isSidebarVisible ? 'block' : 'none' }}>
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
                  backgroundColor: location.pathname === '/projects' && !location.pathname.includes('/projects/') ? '#3498db' : 'transparent',
                  color: location.pathname === '/projects' && !location.pathname.includes('/projects/') ? 'white' : '#333',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
              >
                <NavLink 
                  to="/projects" 
                  style={({ isActive }) => ({
                    display: 'block',
                    padding: '6px 8px',
                    backgroundColor: isActive && location.pathname === '/projects' ? '#3498db' : 'transparent',
                    color: isActive && location.pathname === '/projects' ? 'white' : '#333',
                    textDecoration: 'none',
                    borderRadius: '3px',
                    fontWeight: 'bold'
                  })}
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
        
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '8px',
            height: '100%',
            cursor: 'col-resize',
            backgroundColor: isResizing ? 'rgba(52, 152, 219, 0.3)' : 'transparent',
            zIndex: 10,
            transition: 'background-color 0.2s ease'
          }}
          onMouseDown={startResizing}
        />
      </div>
    </div>
  );
};

export default Sidebar;
