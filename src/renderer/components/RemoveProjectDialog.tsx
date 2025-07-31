import React from 'react';

interface RemoveProjectDialogProps {
  isOpen: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const RemoveProjectDialog: React.FC<RemoveProjectDialogProps> = ({ 
  isOpen, 
  projectName, 
  onClose, 
  onConfirm 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Remove Project</h2>
        <p>
          Are you sure you want to remove the project <strong>{projectName}</strong>?
        </p>
        <p>
          This will not delete any files from disk, only remove the project from the application.
        </p>
        
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button 
            type="button" 
            onClick={onConfirm}
            style={{ backgroundColor: '#d9534f', color: 'white' }}
          >
            Remove Project
          </button>
        </div>
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

export default RemoveProjectDialog;
