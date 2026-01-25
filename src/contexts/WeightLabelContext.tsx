'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type WeightUnit = 'g' | 'kg' | 'lb' | 'oz';

interface WeightLabelContextType {
  weightLabel: WeightUnit;
  loading: boolean;
}

const WeightLabelContext = createContext<WeightLabelContextType | undefined>(undefined);

export function WeightLabelProvider({ children }: { children: ReactNode }) {
  const [weightLabel, setWeightLabel] = useState<WeightUnit>('g');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeightLabel = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/settings/weight-label');
        const data = await response.json();
        
        if (data.success && data.weightLabel) {
          setWeightLabel(data.weightLabel as WeightUnit);
        }
      } catch (error) {
        console.error('Error fetching weight label:', error);
        // Keep default 'g' on error
      } finally {
        setLoading(false);
      }
    };

    fetchWeightLabel();
  }, []);

  return (
    <WeightLabelContext.Provider value={{ weightLabel, loading }}>
      {children}
    </WeightLabelContext.Provider>
  );
}

export function useWeightLabel() {
  const context = useContext(WeightLabelContext);
  if (context === undefined) {
    throw new Error('useWeightLabel must be used within a WeightLabelProvider');
  }
  return context;
}

