import React, { useState } from 'react';

interface SettingsState {
  defaultProjectLocation: string;
  autoSaveInterval: number;
  theme: 'light' | 'dark' | 'system';
  showHiddenFiles: boolean;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>({
    defaultProjectLocation: '/Users/user/Documents/Projects',
    autoSaveInterval: 5,
    theme: 'system',
    showHiddenFiles: false
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : type === 'number' 
          ? parseInt(value, 10) 
          : value
    }));
  };

  const handleBrowseLocation = () => {
    // In a real app, this would open a dialog to select a directory
    console.log('Browse for default project location');
  };

  const handleSave = () => {
    // In a real app, this would save settings to the main process
    setIsSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      
      // Reset success message after a delay
      setTimeout(() => {
        setSaveSuccess(null);
      }, 3000);
    }, 1000);
  };

  const handleReset = () => {
    // Reset to default settings
    setSettings({
      defaultProjectLocation: '/Users/user/Documents/Projects',
      autoSaveInterval: 5,
      theme: 'system',
      showHiddenFiles: false
    });
  };

  return (
    <div>
      <h2>Settings</h2>
      
      <div style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label>Default Project Location</label>
          <div style={{ display: 'flex' }}>
            <input 
              type="text" 
              name="defaultProjectLocation"
              value={settings.defaultProjectLocation}
              onChange={handleChange}
              style={{ flex: 1, marginRight: '10px' }}
            />
            <button onClick={handleBrowseLocation} className="secondary">Browse...</button>
          </div>
        </div>
        
        <div className="form-group">
          <label>Auto-Save Interval (minutes)</label>
          <input 
            type="number" 
            name="autoSaveInterval"
            value={settings.autoSaveInterval}
            onChange={handleChange}
            min={1}
            max={60}
          />
        </div>
        
        <div className="form-group">
          <label>Theme</label>
          <select 
            name="theme"
            value={settings.theme}
            onChange={handleChange}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System Default</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>
            <input 
              type="checkbox" 
              name="showHiddenFiles"
              checked={settings.showHiddenFiles}
              onChange={handleChange}
              style={{ width: 'auto', marginRight: '10px' }}
            />
            Show Hidden Files
          </label>
        </div>
        
        <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
          <button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          <button onClick={handleReset} className="secondary">
            Reset to Defaults
          </button>
        </div>
        
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
