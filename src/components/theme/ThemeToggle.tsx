'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon, Laptop } from 'lucide-react';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.toggleContainer} role="radiogroup" aria-label="Theme selector">
      <button
        type="button"
        className={`${styles.toggleBtn} ${theme === 'light' ? styles.active : ''}`}
        onClick={() => setTheme('light')}
        title="Light Mode"
        aria-label="Light Mode"
      >
        <Sun size={15} />
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${theme === 'dark' ? styles.active : ''}`}
        onClick={() => setTheme('dark')}
        title="Dark Mode"
        aria-label="Dark Mode"
      >
        <Moon size={15} />
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${theme === 'system' ? styles.active : ''}`}
        onClick={() => setTheme('system')}
        title="System Preference"
        aria-label="System Preference"
      >
        <Laptop size={15} />
      </button>
    </div>
  );
}
