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
    if (!api) {
      console.warn('ProjectDetail: API is not available');
      setIsLoading(false);
      setProject(null); // Ensure project is null when API is not available
      return () => {};
    }

    if (!id) {
      console.warn('ProjectDetail: No project ID provided');
      setIsLoading(false);
      setProject(null); // Ensure project is null when no ID is provided
      return () => {};
    }

    console.log('ProjectDetail: Setting up event listener for projects-loaded');
    // Set up event listener for projects loaded
    api.onProjectsLoaded((loadedProjects) => {
      console.log('ProjectDetail: Received projects from main process:', loadedProjects);
      // Find the specific project by ID
      const foundProject = loadedProjects.find(p => p.id === id);
      if (foundProject) {
        console.log('ProjectDetail: Found project:', foundProject);
        setProject(foundProject);
      } else {
        console.warn(`ProjectDetail: Project with ID ${id} not found`);
        setProject(null); // Ensure project is null when not found
      }
      setIsLoading(false);
    });
    
    api.onError((error) => {
      console.error('ProjectDetail: Error loading project:', error);
      setIsLoading(false);
      setProject(null); // Ensure project is null on error
    });
    
    // Request projects to be loaded
    console.log('ProjectDetail: Requesting projects from main process');
    api.loadProjects();
    
    // Clean up event listeners
    return () => {
      console.log('ProjectDetail: Removing event listeners');
      if (api.removeAllListeners) {
        api.removeAllListeners('projects-loaded');
        api.removeAllListeners('error');
      }
    };
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
