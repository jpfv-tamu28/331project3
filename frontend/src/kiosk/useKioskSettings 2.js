import { useEffect, useState } from 'react';

export const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'contrast', label: 'High contrast' },
];

export const TEXT_SIZES = [
  { value: 'default', label: 'Default', scale: 1 },
  { value: 'large', label: 'Large', scale: 1.2 },
  { value: 'xlarge', label: 'Extra large', scale: 1.4 },
];

const STORAGE_KEY = 'kiosk-settings';
const DEFAULTS = { theme: 'light', textSize: 'default' };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      theme: THEMES.some((t) => t.value === saved?.theme) ? saved.theme : DEFAULTS.theme,
      textSize: TEXT_SIZES.some((s) => s.value === saved?.textSize) ? saved.textSize : DEFAULTS.textSize,
    };
  } catch {
    return DEFAULTS;
  }
}

export function useKioskSettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.kioskTheme = settings.theme;
    root.style.setProperty('--kiosk-text', TEXT_SIZES.find((s) => s.value === settings.textSize).scale);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      
    }
  }, [settings]);

  useEffect(() => () => {
    delete document.documentElement.dataset.kioskTheme;
    document.documentElement.style.removeProperty('--kiosk-text');
  }, []);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  return [settings, update];
}
