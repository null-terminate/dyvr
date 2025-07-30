import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMainProcess } from '../context/MainProcessContext';
import { Project } from '../types/mainProcessTypes';
import CreateProjectDialog from '../components/CreateProjectDialog';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
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
    
    // Register the event listeners
    api.onProjectCreated(handleProjectCreated);
    
    // Request projects to be loaded
    api.loadProjects();
    
    // Clean up event listener
    return () => {
      if (api.removeAllListeners) {
        api.removeAllListeners('projects-loaded');
        api.removeAllListeners('project-created');
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
                  onClick={() => navigate(`/projects/${project.id}`)}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{project.name}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{project.path || project.workingDirectory}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
                    {project.lastOpened ? project.lastOpened.toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
                    {project.created ? project.created.toLocaleDateString() : 'N/A'}
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
