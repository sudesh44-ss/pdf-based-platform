'use client';

import React from 'react';
import { Crop, RotateCcw, Smartphone, Monitor, Check } from 'lucide-react';
import { CropSettings } from '@/lib/types/database';
import styles from './SmartCropOverlay.module.css';

interface SmartCropOverlayProps {
  settings: CropSettings;
  onChange: (settings: CropSettings) => void;
  onReset: () => void;
}

export function SmartCropOverlay({ settings, onChange, onReset }: SmartCropOverlayProps) {
  const handleAutoDetectMobile = () => {
    onChange({
      enabled: true,
      x: 3,
      y: 6, // crop status bar
      width: 94,
      height: 88, // crop bottom navigation
      isAutoDetected: true,
    });
  };

  const handleAutoDetectDesktop = () => {
    onChange({
      enabled: true,
      x: 4,
      y: 8, // crop top window bar
      width: 92,
      height: 87, // crop taskbar
      isAutoDetected: true,
    });
  };

  return (
    <div className={styles.cropBar} role="region" aria-label="Smart Crop View Controls">
      <div className={styles.titleArea}>
        <Crop size={16} />
        <span>Smart Crop Active</span>
      </div>

      <div className={styles.presetGroup}>
        <button
          type="button"
          className={styles.presetBtn}
          onClick={handleAutoDetectMobile}
          title="Auto-crop mobile status & navigation bars"
        >
          <Smartphone size={13} style={{ display: 'inline', marginRight: '4px' }} />
          Mobile Preset
        </button>
        <button
          type="button"
          className={styles.presetBtn}
          onClick={handleAutoDetectDesktop}
          title="Auto-crop desktop window borders"
        >
          <Monitor size={13} style={{ display: 'inline', marginRight: '4px' }} />
          Desktop Preset
        </button>
      </div>

      <div className={styles.sliders}>
        <div className={styles.sliderGroup}>
          <label htmlFor="cropTopSlider">Top:</label>
          <input
            id="cropTopSlider"
            type="range"
            min="0"
            max="30"
            value={settings.y}
            onChange={(e) => onChange({ ...settings, y: Number(e.target.value) })}
            className={styles.rangeInput}
            aria-label="Crop Top Margin"
          />
          <span>{settings.y}%</span>
        </div>

        <div className={styles.sliderGroup}>
          <label htmlFor="cropHeightSlider">Bottom:</label>
          <input
            id="cropHeightSlider"
            type="range"
            min="50"
            max="100"
            value={settings.height}
            onChange={(e) => onChange({ ...settings, height: Number(e.target.value) })}
            className={styles.rangeInput}
            aria-label="Crop Bottom Height"
          />
          <span>{100 - settings.height}%</span>
        </div>

        <div className={styles.sliderGroup}>
          <label htmlFor="cropSidesSlider">Sides:</label>
          <input
            id="cropSidesSlider"
            type="range"
            min="0"
            max="20"
            value={settings.x}
            onChange={(e) => onChange({ ...settings, x: Number(e.target.value) })}
            className={styles.rangeInput}
            aria-label="Crop Sides Margin"
          />
          <span>{settings.x}%</span>
        </div>
      </div>

      <button
        type="button"
        className={styles.resetBtn}
        onClick={onReset}
        title="Return to Original View"
      >
        <RotateCcw size={12} style={{ display: 'inline', marginRight: '4px' }} />
        Original View
      </button>
    </div>
  );
}
