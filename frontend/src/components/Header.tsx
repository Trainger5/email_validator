import React from 'react';

interface HeaderProps {
  templateUrl: (type: 'csv' | 'excel') => string;
}

export const Header: React.FC<HeaderProps> = ({ templateUrl }) => {
  return (
    <header className="hero">
      <div className="hero-content">
        <div className="hero-main">
          <p className="eyebrow">Email Validation Platform</p>
          <h1>Email Validator</h1>
          <p className="lede">
            Real-time email validation with DNS + SMTP verification, bounce risk estimation,
            and comprehensive logging. Upload CSV/XLSX files or integrate via API.
          </p>

          <div className="cta-row">
            <a className="btn primary" href={templateUrl('excel')} download>
              Download Excel Template
            </a>
            <a className="btn ghost" href={templateUrl('csv')} download>
              Download CSV Template
            </a>
          </div>

          <div className="chip">
            Template includes: Email, Name, From Name, CC, BCC, Reply To, Subject, TrackingID, Opened, Last Opened, Clicked, Last Clicked, Unsubscribed, Status
          </div>
        </div>

        <div className="stat-cloud">
          <div>
            <p className="muted">Storage</p>
            <h3>SQLite</h3>
          </div>
          <div>
            <p className="muted">Validation</p>
            <h3>Real-time</h3>
          </div>
          <div>
            <p className="muted">Export</p>
            <h3>CSV / API</h3>
          </div>
        </div>
      </div>
    </header>
  );
};
