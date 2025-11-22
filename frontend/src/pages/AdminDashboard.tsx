import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminValidations, fetchAdminStats, AdminStats } from '../api';

interface AdminDashboardProps {
    authUser: { username: string; role: string };
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ authUser }) => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminStats();
            setStats(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load stats');
        } finally {
            setLoading(false);
        }
    };

    const exportHref = `/api/admin/export?token=${localStorage.getItem('token') || ''}`;

    return (
        <div className="dashboard-page">
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <div>
                        <h1>Admin Dashboard</h1>
                        <p className="muted">System-wide analytics and management</p>
                    </div>
                    <div className="dashboard-actions">
                        <button className="btn ghost" onClick={loadStats} disabled={loading}>
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <a href={exportHref} className="btn primary" target="_blank" rel="noreferrer">
                            Export Data
                        </a>
                    </div>
                </div>

                {error && (
                    <div className="result status-error">
                        {error}
                    </div>
                )}

                {stats && (
                    <>
                        <div className="dashboard-section">
                            <h2>System Statistics</h2>
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <p className="tiny muted">Total Validations</p>
                                    <h3>{stats.total}</h3>
                                </div>
                                <div className="stat-card">
                                    <p className="tiny muted">Deliverable</p>
                                    <h3 className="status-ok">{stats.deliverable}</h3>
                                </div>
                                <div className="stat-card">
                                    <p className="tiny muted">Undeliverable</p>
                                    <h3 className="status-error">{stats.undeliverable}</h3>
                                </div>
                                <div className="stat-card">
                                    <p className="tiny muted">Invalid</p>
                                    <h3 className="status-error">{stats.invalid}</h3>
                                </div>
                                <div className="stat-card">
                                    <p className="tiny muted">Bounce Risk</p>
                                    <h3 className="status-unknown">{stats.bounce_likely}</h3>
                                </div>
                            </div>
                        </div>

                        {stats.recent && stats.recent.length > 0 && (
                            <div className="dashboard-section">
                                <h2>Recent Activity</h2>
                                <div className="recent-list">
                                    {stats.recent.slice(0, 10).map((item, idx) => (
                                        <div key={idx} className="recent-item">
                                            <span className="recent-email">{item.email}</span>
                                            <span className="recent-status">
                                                {item.validation_status}
                                                {item.validation_reason ? ` (${item.validation_reason})` : ''}
                                            </span>
                                            <span className="recent-date muted tiny">{item.created_at}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="dashboard-section">
                    <h2>Quick Actions</h2>
                    <div className="dashboard-grid">
                        <div className="dashboard-card feature-card">
                            <div className="card-icon">✓</div>
                            <h3>Validation Tools</h3>
                            <p>Access all email validation features</p>
                            <Link to="/validate" className="btn primary">
                                Go to Validation
                            </Link>
                        </div>

                        <div className="dashboard-card feature-card">
                            <div className="card-icon">📊</div>
                            <h3>Full Admin Panel</h3>
                            <p>View detailed logs and manage all validations</p>
                            <Link to="/validate" state={{ tab: 'admin' }} className="btn ghost">
                                Open Admin Panel
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
