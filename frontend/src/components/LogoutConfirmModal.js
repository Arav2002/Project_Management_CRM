import React from 'react';
import '../styles/modal.css';

const LogoutConfirmModal = ({ onConfirm, onCancel }) => (
  <div className="pms-modal-overlay" onClick={onCancel}>
    <div className="pms-modal logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
      <div className="pms-modal-header">
        <h5><i className="fa-solid fa-right-from-bracket"></i> Log Out</h5>
        <button className="pms-modal-close" onClick={onCancel}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="pms-modal-body">
        <p className="logout-confirm-text">
          Are you sure you want to log out? You'll need to sign back in to access your AWS accounts and projects.
        </p>
        <div className="pms-modal-actions">
          <button type="button" className="pms-btn pms-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="pms-btn pms-btn-danger" onClick={onConfirm}>
            <i className="fa-solid fa-right-from-bracket"></i> Log Out
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default LogoutConfirmModal;
