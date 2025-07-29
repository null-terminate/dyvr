import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useElectron } from '../context/ElectronContext';

interface ProjectDetails {
  id: string;
  name: string;
  path?: string;
  workingDirectory: string;
  description?: string;
  created?: Date;
  lastOpened?: Date;
  sourceFolders?: Array<{
    id: string;
    path: string;
  }>;
}

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'settings'>('details');
  const api = useElectron();

  useEffect(() => {
    if (api && id) {
      // Set up event listener for projects loaded
      api.onProjectsLoaded((loadedProjects) => {
        // Find the specific project by ID
        const foundProject = loadedProjects.find(p => p.id === id);
        if (foundProject) {
          setProject(foundProject);
        }
        setIsLoading(false);
      });
      
      api.onError((error) => {
        console.error('Error loading project:', error);
        setIsLoading(false);
      });
      
      // Request projects to be loaded
      api.loadProjects();
      
      // Clean up event listeners
      return () => {
        api.removeAllListeners('projects-loaded');
        api.removeAllListeners('error');
      };
    } else {
      // Mock data for development without Electron
      const mockProject: ProjectDetails = {
        id: id || '1',
        name: `Project ${id === '1' ? 'Alpha' : id === '2' ? 'Beta' : id === '3' ? 'Gamma' : 'Unknown'}`,
        path: `/Users/user/Documents/Projects/${id === '1' ? 'Alpha' : id === '2' ? 'Beta' : id === '3' ? 'Gamma' : 'Unknown'}`,
        workingDirectory: `/Users/user/Documents/Projects/${id === '1' ? 'Alpha' : id === '2' ? 'Beta' : id === '3' ? 'Gamma' : 'Unknown'}`,
        description: 'This is a sample project description. It would contain details about the project purpose and goals.',
        created: new Date(2025, 5, 10),
        lastOpened: new Date(2025, 6, 25),
        sourceFolders: [
          {
            id: 'src-1',
            path: `/Users/user/Documents/Projects/${id === '1' ? 'Alpha' : id === '2' ? 'Beta' : id === '3' ? 'Gamma' : 'Unknown'}/src`
          },
          {
            id: 'assets-1',
            path: `/Users/user/Documents/Projects/${id === '1' ? 'Alpha' : id === '2' ? 'Beta' : id === '3' ? 'Gamma' : 'Unknown'}/assets`
          }
        ]
      };
      
      const timeoutId = setTimeout(() => {
        setProject(mockProject);
        setIsLoading(false);
      }, 500);
      
      // Return cleanup function for non-Electron environment
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [id, api]);

  const handleAddSourceDirectory = () => {
    if (api && project) {
      // In a real app, this would open a dialog to select a directory
      // and then call the API to add the source folder
      console.log('Add source directory to project', project.id);
    } else {
      console.log('Add source directory');
    }
  };

  const renderTabContent = () => {
    if (!project) return null;

    switch (activeTab) {
      case 'details':
        return (
          <div>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={project.name} readOnly />
            </div>
            <div className="form-group">
              <label>Path</label>
              <input type="text" value={project.path || project.workingDirectory} readOnly />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea 
                value={project.description || 'No description available.'} 
                readOnly 
                style={{ height: '100px' }}
              />
            </div>
            <div className="form-group">
              <label>Created</label>
              <input 
                type="text" 
                value={project.created ? project.created.toLocaleDateString() : 'N/A'} 
                readOnly 
              />
            </div>
            <div className="form-group">
              <label>Last Opened</label>
              <input 
                type="text" 
                value={project.lastOpened ? project.lastOpened.toLocaleDateString() : 'N/A'} 
                readOnly 
              />
            </div>
          </div>
        );
      case 'files':
        return (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3>Source Directories</h3>
              <button onClick={handleAddSourceDirectory}>Add Source Directory</button>
            </div>
            {project.sourceFolders && project.sourceFolders.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {project.sourceFolders.map((folder) => (
                  <li 
                    key={folder.id}
                    style={{
                      padding: '10px',
                      marginBottom: '10px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    {folder.path}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No source directories added yet.</p>
            )}
          </div>
        );
      case 'settings':
        return (
          <div>
            <h3>Project Settings</h3>
            <p>Project settings would go here.</p>
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <p>Loading project details...</p>;
  }

  if (!project) {
    return <p>Project not found.</p>;
  }

  return (
    <div>
      <h2>{project.name}</h2>
      
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex' }}>
          {(['details', 'files', 'settings'] as const).map(tab => (
            <div
              key={tab}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
                backgroundColor: activeTab === tab ? '#f0f0f0' : 'transparent',
                borderBottom: activeTab === tab ? '2px solid #3498db' : 'none'
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </div>
          ))}
        </div>
      </div>
      
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ProjectDetail;
