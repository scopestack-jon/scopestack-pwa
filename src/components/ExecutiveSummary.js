import React from 'react';
import './ExecutiveSummary.css'; // Optional: Create a CSS file for styling

const ExecutiveSummary = ({ summary, onClose, onRegenerate, isLoading, onEditPrompt }) => {
  return (
    <div className="executive-summary-overlay">
      <div className="executive-summary-modal">
        <div className="executive-summary-header">
          <h2>Executive Summary</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="executive-summary-content">
          {summary.split('\n').map((paragraph, index) => (
            paragraph.trim() ? <p key={index}>{paragraph}</p> : null
          ))}
        </div>
        <div className="executive-summary-actions">
          {onRegenerate && (
            <button 
              className="regenerate-button" 
              onClick={onRegenerate}
              disabled={isLoading}
            >
              {isLoading ? 'Regenerating...' : 'Regenerate Summary'}
            </button>
          )}
          {onEditPrompt && (
            <button 
              className="edit-prompt-button" 
              onClick={onEditPrompt}
            >
              Edit AI Prompt
            </button>
          )}
          <button className="close-text-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSummary; 