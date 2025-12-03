import { KeyBinding } from '../types';

export const isShortcutPressed = (e: KeyboardEvent, binding: KeyBinding): boolean => {
  if (!binding) return false;

  const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase() || e.code === binding.key;
  const ctrlMatch = !!binding.ctrlKey === (e.ctrlKey || e.metaKey); // Treat Cmd as Ctrl for Mac convenience usually, or specific meta
  const shiftMatch = !!binding.shiftKey === e.shiftKey;
  const altMatch = !!binding.altKey === e.altKey;

  return keyMatch && ctrlMatch && shiftMatch && altMatch;
};

export const formatShortcut = (binding: KeyBinding): string => {
  if (!binding) return '';
  const parts = [];
  if (binding.ctrlKey) parts.push('Ctrl');
  if (binding.altKey) parts.push('Alt');
  if (binding.shiftKey) parts.push('Shift');
  
  let keyDisplay = binding.key.toUpperCase();
  if (binding.key === ' ') keyDisplay = 'Space';
  if (binding.key === 'ArrowUp') keyDisplay = '↑';
  if (binding.key === 'ArrowDown') keyDisplay = '↓';
  if (binding.key === 'ArrowLeft') keyDisplay = '←';
  if (binding.key === 'ArrowRight') keyDisplay = '→';
  
  parts.push(keyDisplay);
  return parts.join('+');
};