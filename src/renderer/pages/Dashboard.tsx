import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectron } from '../context/ElectronContext';
import { Project } from '../types/electronTypes';

interface ProjectSummary {
  id: string;
  name: string;
  lastOpened: Date;
}

const Dashboard: React.FC = () => {
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const api = useElectron();

  useEffect(() => {
    if (!api) {
      console.warn('Electron API not available, cannot load projects');
      setIsLoading(false);
      return;
    }

    // Set up event listener for when projects are loaded
    const handleProjectsLoaded = (projects: any[]) => {
      console.log('Projects loaded:', projects);
      
      // Convert Project to ProjectSummary
      const projectSummaries: ProjectSummary[] = projects.map(project => ({
        id: project.id,
        name: project.name,
        lastOpened: project.lastModified ? new Date(project.lastModified) : new Date()
      }));
      
      setRecentProjects(projectSummaries);
      setIsLoading(false);
    };

    // Register the event listener
    api.onProjectsLoaded(handleProjectsLoaded);

    // Request to load projects
    api.loadProjects();

    // Cleanup function to remove event listener
    return () => {
      api.removeAllListeners('projects-loaded');
    };
  }, [api]);

  const handleCreateProject = () => {
    // In a real app, this would open a dialog to create a new project
    console.log('Create new project');
  };

  const handleOpenProject = () => {
    // In a real app, this would open a dialog to select a project
    console.log('Open existing project');
  };

  return (
    <div>
      <h2>Dashboard</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleCreateProject} style={{ marginRight: '10px' }}>
          Create New Project
        </button>
        <button onClick={handleOpenProject} className="secondary">
          Open Existing Project
        </button>
      </div>
      
      <h3>Recent Projects</h3>
      {isLoading ? (
        <p>Loading recent projects...</p>
      ) : recentProjects.length > 0 ? (
        <div>
          {recentProjects.map(project => (
            <div 
              key={project.id}
              style={{
                padding: '10px',
                marginBottom: '10px',
                backgroundColor: 'white',
                borderRadius: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                cursor: 'pointer'
              }}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div style={{ fontWeight: 'bold' }}>{project.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Last opened: {project.lastOpened.toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No recent projects found.</p>
      )}
    </div>
  );
};

export default Dashboard;
