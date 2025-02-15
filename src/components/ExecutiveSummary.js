import React from 'react';
import './ExecutiveSummary.css'; // Optional: Create a CSS file for styling

const ExecutiveSummary = ({ summary, onClose }) => {
  return (
    <div className="executive-summary-window">
      <div className="executive-summary-header">
        <h2>Executive Summary</h2>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="executive-summary-content">
        <p>{summary}</p>
      </div>
    </div>
  );
};

export default ExecutiveSummary; 