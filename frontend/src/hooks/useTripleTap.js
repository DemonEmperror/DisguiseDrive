import { useCallback } from 'react';

/**
 * Custom hook for detecting bottom area tap to unlock
 * @param {Function} onUnlock - Callback function to execute on unlock tap
 * @returns {Object} Event handlers for bottom tap detection
 */
export const useBottomTap = (onUnlock) => {
  const handleBottomTap = useCallback((e) => {
    console.log('useBottomTap: Event triggered', e.type);
    e.preventDefault();
    e.stopPropagation();
    onUnlock();
  }, [onUnlock]);

  const handleContextMenu = useCallback((e) => {
    // Prevent context menu on right-click
    e.preventDefault();
  }, []);

  return {
    onTouchStart: handleBottomTap,
    onClick: handleBottomTap,
    onMouseDown: handleBottomTap,
    onContextMenu: handleContextMenu,
  };
};
