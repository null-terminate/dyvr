import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectron } from '../context/ElectronContext';

interface Project {
  id: string;
  name: string;
  path: string;
  workingDirectory: string;
  lastOpened?: Date;
  created?: Date;
}

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const api = useElectron();

  useEffect(() => {
    if (api) {
      // Set up event listener for projects loaded
      api.onProjectsLoaded((loadedProjects) => {
        setProjects(loadedProjects);
        setIsLoading(false);
      });
      
      // Request projects to be loaded
      api.loadProjects();
      
      // Clean up event listener
      return () => {
        api.removeAllListeners('projects-loaded');
      };
    } else {
      // Mock data for development without Electron
      const mockProjects: Project[] = [
        { 
          id: '1', 
          name: 'Project Alpha', 
          path: '/Users/user/Documents/Projects/Alpha',
          workingDirectory: '/Users/user/Documents/Projects/Alpha',
          lastOpened: new Date(2025, 6, 25),
          created: new Date(2025, 5, 10)
        },
        { 
          id: '2', 
          name: 'Project Beta', 
          path: '/Users/user/Documents/Projects/Beta',
          workingDirectory: '/Users/user/Documents/Projects/Beta',
          lastOpened: new Date(2025, 6, 20),
          created: new Date(2025, 4, 15)
        },
        { 
          id: '3', 
          name: 'Project Gamma', 
          path: '/Users/user/Documents/Projects/Gamma',
          workingDirectory: '/Users/user/Documents/Projects/Gamma',
          lastOpened: new Date(2025, 6, 15),
          created: new Date(2025, 3, 20)
        },
        { 
          id: '4', 
          name: 'Project Delta', 
          path: '/Users/user/Documents/Projects/Delta',
          workingDirectory: '/Users/user/Documents/Projects/Delta',
          lastOpened: new Date(2025, 5, 10),
          created: new Date(2025, 2, 5)
        }
      ];
      
      const timeoutId = setTimeout(() => {
        setProjects(mockProjects);
        setIsLoading(false);
      }, 500);
      
      // Return cleanup function for non-Electron environment
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [api]);

  const handleCreateProject = () => {
    // In a real app, this would open a dialog to create a new project
    console.log('Create new project');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Projects</h2>
        <button onClick={handleCreateProject}>Create New Project</button>
      </div>
      
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
