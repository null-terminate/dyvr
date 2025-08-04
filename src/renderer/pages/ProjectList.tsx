import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMainProcess } from '../context/MainProcessContext';
import { Project } from '../types/mainProcessTypes';
import CreateProjectDialog from '../components/CreateProjectDialog';
import RemoveProjectDialog from '../components/RemoveProjectDialog';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState<boolean>(false);
  const [projectToRemove, setProjectToRemove] = useState<{id: string, name: string} | null>(null);
  const navigate = useNavigate();
  const api = useMainProcess();

  useEffect(() => {
    if (!api) {
      setIsLoading(false);
      setProjects([]); // Set empty projects array when API is not available
      return () => {};
    }

    // Set up event listener for projects loaded
    api.onProjectsLoaded((loadedProjects: Project[]) => {
      setProjects(loadedProjects);
      setIsLoading(false);
    });
    
    // Set up event listener for when a project is created
    const handleProjectCreated = (project: Project) => {
      // Refresh the project list
      api.loadProjects();
    };
    
    // Set up event listener for when a project is deleted
    const handleProjectDeleted = (projectId: string) => {
      // Refresh the project list
      api.loadProjects();
    };
    
    // Register the event listeners
    api.onProjectCreated(handleProjectCreated);
    api.onProjectDeleted(handleProjectDeleted);
    
    // Request projects to be loaded
    api.loadProjects();
    
    // Clean up event listener
    return () => {
      if (api.removeAllListeners) {
        api.removeAllListeners('projects-loaded');
        api.removeAllListeners('project-created');
        api.removeAllListeners('project-deleted');
      }
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

  const handleRemoveProject = (project: {id: string, name: string}) => {
    if (!api) return;
    
    setProjectToRemove(project);
    setIsRemoveDialogOpen(true);
  };
  
  const confirmRemoveProject = () => {
    if (!api || !projectToRemove) return;
    
    api.deleteProject(projectToRemove.id);
    setIsRemoveDialogOpen(false);
    setProjectToRemove(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Projects</h2>
        <button onClick={handleCreateProject}>Create New Project</button>
      </div>
      
      <CreateProjectDialog 
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateProjectSubmit}
      />
      
      <RemoveProjectDialog
        isOpen={isRemoveDialogOpen}
        projectName={projectToRemove?.name || ''}
        onClose={() => {
          setIsRemoveDialogOpen(false);
          setProjectToRemove(null);
        }}
        onConfirm={confirmRemoveProject}
      />
      
      {isLoading ? (
        <p>Loading projects...</p>
      ) : projects.length > 0 ? (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #ddd' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #ddd' }}>Path</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #ddd' }}>Last Opened</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #ddd' }}>Created</th>
                <th style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #ddd', width: '50px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr 
                  key={project.id}
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <td 
                    style={{ padding: '10px', borderBottom: '1px solid #ddd' }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >{project.name}</td>
                  <td 
                    style={{ padding: '10px', borderBottom: '1px solid #ddd' }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >{project.path || project.workingDirectory}</td>
                  <td 
                    style={{ padding: '10px', borderBottom: '1px solid #ddd' }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    {project.lastOpened ? project.lastOpened.toLocaleDateString() : 'N/A'}
                  </td>
                  <td 
                    style={{ padding: '10px', borderBottom: '1px solid #ddd' }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    {project.created ? project.created.toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
                    <button 
                      className="delete-project-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProject({id: project.id, name: project.name});
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        color: '#e53935',
                        border: '1px solid #e53935',
                        backgroundColor: 'transparent',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Remove project"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
        </div>
      ) : (
        <div>
          <p>No projects found.</p>
          <p>Click the "Create New Project" button to get started.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
