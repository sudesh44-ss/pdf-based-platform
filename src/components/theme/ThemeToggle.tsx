'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon, Laptop } from 'lucide-react';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={styles.toggleContainer}
      role="radiogroup"
      aria-label="Theme selector"
      suppressHydrationWarning
    >
      <button
        type="button"
        className={`${styles.toggleBtn} ${mounted && theme === 'light' ? styles.active : ''}`}
        onClick={() => setTheme('light')}
        title="Light Mode"
        aria-label="Light Mode"
        suppressHydrationWarning
      >
        <Sun size={15} />
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${mounted && theme === 'dark' ? styles.active : ''}`}
        onClick={() => setTheme('dark')}
        title="Dark Mode"
        aria-label="Dark Mode"
        suppressHydrationWarning
      >
        <Moon size={15} />
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${mounted && theme === 'system' ? styles.active : ''}`}
        onClick={() => setTheme('system')}
        title="System Preference"
        aria-label="System Preference"
        suppressHydrationWarning
      >
        <Laptop size={15} />
      </button>
    </div>
  );
}
