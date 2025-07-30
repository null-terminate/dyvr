import React, { useState } from 'react';
import { useMainProcess } from '../context/MainProcessContext';

interface AddSourceDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (folderPath: string) => void;
}

const AddSourceDirectoryModal: React.FC<AddSourceDirectoryModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [folderPath, setFolderPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const api = useMainProcess();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    if (!folderPath.trim()) {
      setError('Folder path is required');
      return;
    }
    
    onSubmit(folderPath);
    // Reset form
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
        <h2>Add Source Directory</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="folderPath">Folder Path:</label>
            <div className="folder-input">
              <input
                type="text"
                id="folderPath"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="Select folder path"
              />
              <button type="button" onClick={handleSelectFolder}>Browse...</button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Add Directory</button>
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

export default AddSourceDirectoryModal;
