import { useEffect, useRef } from 'react';

// Registers a single document-level keydown listener and dispatches to
// whichever handler matches. Uses a ref for the shortcut map so the
// listener is attached once on mount, not re-attached on every render.
//
// Convention: plain letter/number keys in the map are triggered with Alt
// held down (e.g. map['1'] fires on Alt+1). The two exceptions are
// 'Escape' (always active, no modifier) and '?' (fires on Shift+/ i.e. "?",
// no Alt needed, matching the common GitHub/Slack-style shortcuts-help key).
//
// Shortcuts are automatically suppressed while the person is typing in an
// input, textarea, select, or any contentEditable element, so normal
// typing in forms is never hijacked.
const useKeyboardShortcuts = (shortcutMap) => {
  const mapRef = useRef(shortcutMap);
  mapRef.current = shortcutMap;

  useEffect(() => {
    const handleKeyDown = (event) => {
      const map = mapRef.current;
      const target = event.target;
      const isTyping =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (event.key === 'Escape') {
        map['Escape']?.(event);
        return;
      }

      if (isTyping) return;

      if (event.key === '?' && map['?']) {
        event.preventDefault();
        map['?'](event);
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (map[key]) {
          event.preventDefault();
          map[key](event);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};

export default useKeyboardShortcuts;
