import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMainProcess } from '../context/MainProcessContext';
import { Project } from '../types/mainProcessTypes';
import CreateProjectDialog from '../components/CreateProjectDialog';

interface ProjectSummary {
  id: string;
  name: string;
  lastOpened: Date;
}

const Dashboard: React.FC = () => {
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const api = useMainProcess();

  useEffect(() => {
    if (!api) {
      setIsLoading(false);
      return;
    }

    // Set up event listener for when projects are loaded
    const handleProjectsLoaded = (projects: Project[]) => {
      // Convert Project to ProjectSummary
      const projectSummaries: ProjectSummary[] = projects.map(project => ({
        id: project.id,
        name: project.name,
        lastOpened: project.lastOpened ? new Date(project.lastOpened) : new Date()
      }));
      
      setRecentProjects(projectSummaries);
      setIsLoading(false);
    };

    // Set up event listener for when a project is created
    const handleProjectCreated = (project: Project) => {
      // Refresh the project list
      api.loadProjects();
    };

    // Register the event listeners
    api.onProjectsLoaded(handleProjectsLoaded);
    api.onProjectCreated(handleProjectCreated);

    // Request to load projects
    api.loadProjects();

    // Cleanup function to remove event listeners
    return () => {
      api.removeAllListeners('projects-loaded');
      api.removeAllListeners('project-created');
    };
  }, [api]);

  const handleCreateProject = () => {
    setIsCreateDialogOpen(true);
  };
  
  const handleCreateProjectSubmit = (projectName: string, folderPath: string) => {
    if (api) {
      api.createProject(projectName, folderPath);
      setIsCreateDialogOpen(false);
    }
  };

  const handleOpenProject = () => {
    // In a real app, this would open a dialog to select a project
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
      
      <CreateProjectDialog 
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateProjectSubmit}
      />
      
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
