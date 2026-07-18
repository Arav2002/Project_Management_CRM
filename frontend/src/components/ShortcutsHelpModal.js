import React from 'react';
import '../styles/modal.css';

const SHORTCUTS = [
  { keys: 'Alt + 1', desc: 'Go to Dashboard' },
  { keys: 'Alt + 2', desc: 'Go to AWS Accounts' },
  { keys: 'Alt + 3', desc: 'Go to Projects' },
  { keys: 'Alt + S', desc: 'Expand / collapse the sidebar' },
  { keys: 'Alt + T', desc: 'Toggle dark / light theme' },
  { keys: 'Alt + L', desc: 'Log out (asks for confirmation)' },
  { keys: 'Shift + ?', desc: 'Show this shortcuts list' },
  { keys: 'Esc', desc: 'Close any open dialog' }
];

const ShortcutsHelpModal = ({ onClose }) => (
  <div className="pms-modal-overlay" onClick={onClose}>
    <div className="pms-modal" onClick={(e) => e.stopPropagation()}>
      <div className="pms-modal-header">
        <h5><i className="fa-solid fa-keyboard"></i> Keyboard Shortcuts</h5>
        <button className="pms-modal-close" onClick={onClose}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="pms-modal-body">
        <ul className="shortcuts-list">
          {SHORTCUTS.map((s) => (
            <li key={s.keys}>
              <span>{s.desc}</span>
              <kbd>{s.keys}</kbd>
            </li>
          ))}
        </ul>
        <p className="shortcuts-note">
          The sidebar only expands/collapses via <kbd>Alt+S</kbd> — there's no separate button for it on purpose, to keep the rail compact.
        </p>
      </div>
    </div>
  </div>
);

export default ShortcutsHelpModal;
