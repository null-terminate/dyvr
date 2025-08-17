import React, { useState, useEffect } from 'react';
import { useMainProcess } from '../context/MainProcessContext';

const Settings: React.FC = () => {
  const [fontFamily, setFontFamily] = useState<'Roboto Mono' | 'Courier New'>('Roboto Mono');
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const api = useMainProcess();

  // Load the current font family preference when the component mounts
  useEffect(() => {
    const loadFontFamily = async () => {
      if (api) {
        try {
          const currentFont = await api.getFontFamily();
          setFontFamily(currentFont);
        } catch (error) {
          console.error('Failed to load font family preference:', error);
        }
      }
    };

    loadFontFamily();
  }, [api]);

  // Handle font family change - now applies immediately
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFontFamily = e.target.value as 'Roboto Mono' | 'Courier New';
    setFontFamily(newFontFamily);
    
    // Apply font change immediately
    if (api) {
      try {
        api.setFontFamily(newFontFamily);
        
        // Show success message
        setSaveSuccess(true);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setSaveSuccess(null);
        }, 3000);
      } catch (error) {
        console.error('Failed to save font family preference:', error);
      }
    }
  };

  return (
    <div>
      <h2>Settings</h2>
      <div style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label>Font Family</label>
          <select 
            value={fontFamily}
            onChange={handleFontFamilyChange}
            style={{ marginBottom: '20px' }}
          >
            <option value="Roboto Mono">Roboto Mono</option>
            <option value="Courier New">Courier New</option>
          </select>
          <p style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
            Select the font family to use throughout the application.
          </p>
        </div>
        
        {/* Save button removed as changes are applied immediately */}
        
        {saveSuccess && (
          <div style={{ 
            marginTop: '20px', 
            padding: '10px', 
            backgroundColor: '#d4edda', 
            color: '#155724',
            borderRadius: '4px'
          }}>
            Settings saved successfully!
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
