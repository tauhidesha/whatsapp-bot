'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface LayoutContextType {
  isHeaderVisible: boolean;
  setIsHeaderVisible: (visible: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  return (
    <LayoutContext.Provider value={{ isHeaderVisible, setIsHeaderVisible }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
