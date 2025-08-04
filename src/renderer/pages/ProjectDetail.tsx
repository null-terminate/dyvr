import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMainProcess } from '../context/MainProcessContext';
import AddSourceDirectoryModal from '../components/AddSourceDirectoryModal';
import RemoveProjectDialog from '../components/RemoveProjectDialog';
import { Project, ScanStatus } from '../types/mainProcessTypes';
import findIcon from '../../assets/Find.png';

// Import ScanProgress interface
interface ScanProgress {
  projectId?: string;
  current: number;
  total: number;
  message: string;
}

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'query'>('details');
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState<boolean>(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanComplete, setScanComplete] = useState<{
    processedFiles: number;
    extractedObjects: number;
  } | null>(null);
  const api = useMainProcess();

  // Function to load a single project
  const loadProject = async () => {
    if (!api || !id) return;
    
    setIsLoading(true);
    
    try {
      // Use the getProject method to fetch only the specific project
      const projectData = await api.getProject(id);
      setProject(projectData);
      
      // Initialize scan status from project data if available
      if (projectData.scanStatus) {
        // Set scanning state
        setIsScanning(projectData.scanStatus.isScanning);
        
        // Set progress if available
        if (projectData.scanStatus.progress) {
          setScanProgress({
            projectId: projectData.id,
            current: projectData.scanStatus.progress.current,
            total: projectData.scanStatus.progress.total,
            message: projectData.scanStatus.progress.message
          });
        }
        
        // Set scan complete info if available and not currently scanning
        if (!projectData.scanStatus.isScanning && projectData.scanStatus.lastScanResult) {
          setScanComplete({
            processedFiles: projectData.scanStatus.lastScanResult.processedFiles,
            extractedObjects: projectData.scanStatus.lastScanResult.extractedObjects
          });
        }
      }
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
    
    // Listen for scan started events
    api.onScanStarted((data) => {
      if (data.projectId === id) {
        setIsScanning(true);
        setScanProgress({
          projectId: id,
          current: 0,
          total: 100,
          message: data.message
        });
      }
    });
    
    // Listen for scan progress events
    api.onScanProgress((progress) => {
      if (progress.projectId === id) {
        setScanProgress(progress);
        setIsScanning(true);
        
        // If progress is complete, reset after a delay
        if (progress.current >= progress.total) {
          setTimeout(() => {
            setIsScanning(false);
          }, 5000); // Keep the completed progress visible for 5 seconds
        }
      }
    });
    
    // Listen for scan complete events
    api.onScanComplete((result) => {
      if (result.projectId === id) {
        setScanComplete({
          processedFiles: result.processedFiles,
          extractedObjects: result.extractedObjects
        });
        
        // Reset scan complete after a delay
        setTimeout(() => {
          setScanComplete(null);
        }, 10000); // Keep the completion message visible for 10 seconds
      }
    });
    
    api.onError((error) => {
      setIsLoading(false);
      setProject(null); // Ensure project is null on error
      setIsScanning(false);
    });
    
    // Clean up event listeners
    return () => {
      if (api.removeAllListeners) {
        api.removeAllListeners('source-folder-added');
        api.removeAllListeners('scan-started');
        api.removeAllListeners('scan-progress');
        api.removeAllListeners('scan-complete');
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

  const handleDeleteProject = () => {
    if (!api || !project) return;
    setIsRemoveDialogOpen(true);
  };
  
  const confirmDeleteProject = () => {
    if (!api || !project) return;
    
    api.deleteProject(project.id);
    
    // Force a refresh of the projects list to update the sidebar
    setTimeout(() => {
      api.loadProjects();
    }, 100);
    
    setIsRemoveDialogOpen(false);
    navigate('/projects');
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
              <input type="text" value={project.workingDirectory} readOnly />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea 
                value="No description available." 
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
              <label>Last Modified</label>
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
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Source Directories</h3>
              <div>
                <button 
                  onClick={handleAddSourceDirectory}
                  style={{ marginRight: '10px' }}
                >
                  Add Source Directory
                </button>
                <button 
                  onClick={() => {
                    if (api && project) {
                      api.scanSourceDirectories(project.id);
                    }
                  }}
                  disabled={!project || !project.sourceFolders || project.sourceFolders.length === 0 || isScanning}
                >
                  {isScanning ? 'Scanning...' : 'Scan'}
                </button>
              </div>
            </div>
            
            {/* Scan Progress Bar */}
            {isScanning && scanProgress && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Scanning files...</span>
                    <span>{Math.round((scanProgress.current / scanProgress.total) * 100)}%</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '10px', 
                    backgroundColor: '#e0e0e0', 
                    borderRadius: '5px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${(scanProgress.current / scanProgress.total) * 100}%`, 
                      height: '100%', 
                      backgroundColor: '#4CAF50',
                      borderRadius: '5px',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>
                    {scanProgress.message}
                  </div>
                </div>
              </div>
            )}
            
            {/* Scan Complete Message */}
            {!isScanning && scanComplete && (
              <div style={{ 
                marginBottom: '20px', 
                padding: '10px', 
                backgroundColor: '#e8f5e9', 
                borderRadius: '4px',
                border: '1px solid #c8e6c9'
              }}>
                <p style={{ margin: 0, color: '#2e7d32' }}>
                  <strong>Scan completed successfully!</strong> Processed {scanComplete.processedFiles} files and extracted {scanComplete.extractedObjects} objects.
                </p>
              </div>
            )}
            
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
                      className="reveal-button"
                    >
                      {/* Reveal */}
                      <img 
                        src={findIcon} 
                        alt="Reveal" 
                        style={{ 
                          width: '24px', 
                          height: '24px',
                        }} 
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No source directories added yet.</p>
            )}
          </div>
        );
      case 'query':
        return (
          <div>
            {/* Import and render the Query component with project ID */}
            {React.createElement(require('../pages/Query').default, { projectId: project.id })}
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
          {(['details', 'files', 'query'] as const).map(tab => (
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
      
      <RemoveProjectDialog
        isOpen={isRemoveDialogOpen}
        projectName={project?.name || ''}
        onClose={() => setIsRemoveDialogOpen(false)}
        onConfirm={confirmDeleteProject}
      />
      
      <div style={{ marginTop: '40px', borderTop: '1px solid #ddd', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={handleDeleteProject}
          className="delete-project-button"
          title="Delete project"
        >
          Delete Project
        </button>
      </div>
    </div>
  );
};

export default ProjectDetail;
