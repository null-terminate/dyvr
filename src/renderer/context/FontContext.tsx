import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useMainProcess } from './MainProcessContext';

// Create a context for the font settings
interface FontContextType {
  fontFamily: 'Roboto Mono' | 'Courier New';
}

const FontContext = createContext<FontContextType | undefined>(undefined);

interface FontProviderProps {
  children: ReactNode;
}

export const FontProvider: React.FC<FontProviderProps> = ({ children }) => {
  const [fontFamily, setFontFamily] = useState<'Roboto Mono' | 'Courier New'>('Roboto Mono');
  const api = useMainProcess();

  useEffect(() => {
    if (!api) return;

    // Load the initial font family preference
    const loadFontFamily = async () => {
      try {
        const currentFont = await api.getFontFamily();
        setFontFamily(currentFont);
      } catch (error) {
        console.error('Failed to load font family preference:', error);
      }
    };

    loadFontFamily();

    // Listen for font family updates
    const handleFontFamilyUpdated = (updatedFont: 'Roboto Mono' | 'Courier New') => {
      setFontFamily(updatedFont);
    };

    api.onFontFamilyUpdated(handleFontFamilyUpdated);

    // Clean up the event listener when the component unmounts
    return () => {
      api.removeAllListeners('font-family-updated');
    };
  }, [api]);

  // Apply the font family to the document root
  useEffect(() => {
    if (fontFamily === 'Roboto Mono') {
      document.documentElement.style.setProperty('--app-font-family', 'var(--roboto-mono-font)');
    } else {
      document.documentElement.style.setProperty('--app-font-family', 'var(--courier-new-font)');
    }
  }, [fontFamily]);

  return (
    <FontContext.Provider value={{ fontFamily }}>
      {children}
    </FontContext.Provider>
  );
};

// Custom hook to use the font context
export const useFont = () => {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error('useFont must be used within a FontProvider');
  }
  return context;
};
