import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMainProcess } from '../context/MainProcessContext';
import AddSourceDirectoryModal from '../components/AddSourceDirectoryModal';

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
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState<boolean>(false);
  const api = useMainProcess();

  // Function to load a single project
  const loadProject = async () => {
    if (!api || !id) return;
    
    setIsLoading(true);
    
    try {
      // Use the getProject method to fetch only the specific project
      const projectData = await api.getProject(id);
      setProject(projectData);
    } catch (error) {
      console.error("Failed to load project:", error);
      setProject(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!api) {
      setIsLoading(false);
      setProject(null); // Ensure project is null when API is not available
      return () => {};
    }

    if (!id) {
      setIsLoading(false);
      setProject(null); // Ensure project is null when no ID is provided
      return () => {};
    }

    // Load the specific project
    loadProject();
    
    // Listen for source folder added events
    api.onSourceFolderAdded((data) => {
      if (data.projectId === id) {
        // Reload just this project
        loadProject();
      }
    });
    
    api.onError((error) => {
      setIsLoading(false);
      setProject(null); // Ensure project is null on error
    });
    
    // Clean up event listeners
    return () => {
      if (api.removeAllListeners) {
        api.removeAllListeners('source-folder-added');
        api.removeAllListeners('error');
      }
    };
  }, [id, api]); // Remove project from dependencies to avoid infinite loop

  const handleAddSourceDirectory = () => {
    setIsAddSourceModalOpen(true);
  };

  const handleSourceDirectorySubmit = (folderPath: string) => {
    if (api && project && id) {
      api.addSourceFolder(id, folderPath);
      setIsAddSourceModalOpen(false);
    }
  };

  const handleRevealFolder = (folderPath: string) => {
    if (api) {
      api.openFolder(folderPath);
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
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{folder.path}</span>
                    <button 
                      onClick={() => handleRevealFolder(folder.path)}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#f0f0f0',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Reveal
                    </button>
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
      
      <AddSourceDirectoryModal 
        isOpen={isAddSourceModalOpen}
        onClose={() => setIsAddSourceModalOpen(false)}
        onSubmit={handleSourceDirectorySubmit}
      />
    </div>
  );
};

export default ProjectDetail;
