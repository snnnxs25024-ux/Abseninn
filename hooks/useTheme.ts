import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const item = window.localStorage.getItem('isDarkMode');
    return item ? JSON.parse(item) : false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  return [isDarkMode, setIsDarkMode] as const;
}
