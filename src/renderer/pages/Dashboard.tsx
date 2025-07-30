import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMainProcess } from '../context/MainProcessContext';
import { Project } from '../types/mainProcessTypes';

interface ProjectSummary {
  id: string;
  name: string;
  lastOpened: Date;
}

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectName: string, folderPath: string) => void;
}

const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const [projectName, setProjectName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const api = useMainProcess();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }
    
    if (!folderPath.trim()) {
      setError('Folder path is required');
      return;
    }
    
    onSubmit(projectName, folderPath);
    // Reset form
    setProjectName('');
    setFolderPath('');
    setError(null);
  };

  const handleSelectFolder = () => {
    if (api) {
      api.selectFolder((selectedPath: string | null) => {
        if (selectedPath) {
          setFolderPath(selectedPath);
        }
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="projectName">Project Name:</label>
            <input
              type="text"
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="folderPath">Parent Folder:</label>
            <div className="folder-input">
              <input
                type="text"
                id="folderPath"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="Select parent folder"
                readOnly
              />
              <button type="button" onClick={handleSelectFolder}>Browse...</button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Create Project</button>
          </div>
        </form>
      </div>
      
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-content {
          background-color: white;
          padding: 20px;
          border-radius: 5px;
          width: 500px;
          max-width: 90%;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        
        .folder-input {
          display: flex;
          gap: 10px;
        }
        
        .folder-input input {
          flex-grow: 1;
        }
        
        .error-message {
          color: red;
          margin-bottom: 15px;
        }
        
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }
      `}</style>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const api = useMainProcess();

  useEffect(() => {
    if (!api) {
      console.warn('Electron API not available, cannot load projects');
      setIsLoading(false);
      return;
    }

    // Set up event listener for when projects are loaded
    const handleProjectsLoaded = (projects: Project[]) => {
      console.log('Projects loaded:', projects);
      
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
      console.log('Project created:', project);
      
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
      console.log(`Creating project: ${projectName} in folder: ${folderPath}`);
      api.createProject(projectName, folderPath);
      setIsCreateDialogOpen(false);
    }
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
