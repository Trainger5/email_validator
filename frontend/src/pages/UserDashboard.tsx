import React from 'react';
import { Link } from 'react-router-dom';

interface UserDashboardProps {
    authUser: { username: string; role: string };
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ authUser }) => {
    return (
        <div className="dashboard-page">
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <div>
                        <h1>Welcome, {authUser.username}!</h1>
                        <p className="muted">Manage your email validation activities</p>
                    </div>
                </div>

                <div className="dashboard-grid">
                    <div className="dashboard-card feature-card">
                        <div className="card-icon">✓</div>
                        <h2>Single Validation</h2>
                        <p>Validate individual email addresses in real-time with comprehensive checks</p>
                        <Link to="/validate" className="btn primary">
                            Start Validating
                        </Link>
                    </div>

                    <div className="dashboard-card feature-card">
                        <div className="card-icon">📋</div>
                        <h2>Bulk Validation</h2>
                        <p>Paste multiple email addresses and validate them all at once</p>
                        <Link to="/validate" state={{ tab: 'bulk' }} className="btn ghost">
                            Bulk Validate
                        </Link>
                    </div>

                    <div className="dashboard-card feature-card">
                        <div className="card-icon">📤</div>
                        <h2>Upload Files</h2>
                        <p>Upload CSV or Excel files to validate large email lists efficiently</p>
                        <Link to="/validate" state={{ tab: 'upload' }} className="btn ghost">
                            Upload File
                        </Link>
                    </div>
                </div>

                <div className="dashboard-section">
                    <h2>Quick Stats</h2>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <p className="tiny muted">Role</p>
                            <h3>{authUser.role}</h3>
                        </div>
                        <div className="stat-card">
                            <p className="tiny muted">Account</p>
                            <h3>Active</h3>
                        </div>
                        <div className="stat-card">
                            <p className="tiny muted">Access Level</p>
                            <h3>Standard</h3>
                        </div>
                    </div>
                </div>

                <div className="dashboard-section">
                    <h2>Recent Activity</h2>
                    <div className="empty-state">
                        <div className="empty-icon">📊</div>
                        <h3>No Recent Validations</h3>
                        <p>Your validation history will appear here once you start validating emails.</p>
                        <Link to="/validate" className="btn primary">
                            Start Your First Validation
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
