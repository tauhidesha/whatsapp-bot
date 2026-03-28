'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface LayoutContextType {
  isHeaderVisible: boolean;
  setIsHeaderVisible: (visible: boolean) => void;
  headerTitle: string;
  setHeaderTitle: (title: string) => void;
  headerExtra: React.ReactNode | null;
  setHeaderExtra: (extra: React.ReactNode | null) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [headerTitle, setHeaderTitle] = useState('SYSTEM OVERVIEW');
  const [headerExtra, setHeaderExtra] = useState<React.ReactNode | null>(null);

  return (
    <LayoutContext.Provider value={{ 
      isHeaderVisible, 
      setIsHeaderVisible,
      headerTitle,
      setHeaderTitle,
      headerExtra,
      setHeaderExtra
    }}>
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
