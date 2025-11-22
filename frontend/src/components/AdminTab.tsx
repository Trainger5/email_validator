import React from 'react';
import { AdminStats } from '../api';

interface AdminTabProps {
    authUser: { username: string; role: string } | null;
    adminData: { total: number; data: any[] } | null;
    adminStats: AdminStats | null;
    adminLoading: boolean;
    adminError: string | null;
    exportHref: string;
    onRefresh: () => void;
}

function bounceLabel(res: { bounce_likely?: boolean | null; bounce_reason?: string | null }) {
    if (res.bounce_likely === true) return `Likely${res.bounce_reason ? ` (${res.bounce_reason})` : ''}`;
    if (res.bounce_likely === false) return 'Unlikely';
    return 'Unknown';
}

export const AdminTab: React.FC<AdminTabProps> = ({
    authUser,
    adminData,
    adminStats,
    adminLoading,
    adminError,
    exportHref,
    onRefresh,
}) => {
    // Not logged in
    if (!authUser) {
        return (
            <article className="card tall">
                <div className="card-head">
                    <div>
                        <p className="eyebrow">Admin Panel</p>
                        <h2>Authentication Required</h2>
                    </div>
                    <span className="badge">Restricted</span>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">🔐</div>
                    <h3>Please Sign In</h3>
                    <p className="muted">
                        Use the login panel on the right to access the admin dashboard.
                        Default credentials: <strong>admin / admin123</strong>
                    </p>
                </div>
            </article>
        );
    }

    // Not admin role
    if (authUser.role !== 'admin') {
        return (
            <article className="card tall">
                <div className="card-head">
                    <div>
                        <p className="eyebrow">Access Denied</p>
                        <h2>Insufficient Permissions</h2>
                    </div>
                    <span className="badge">User</span>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">⚠️</div>
                    <h3>Admin Access Only</h3>
                    <p className="muted">
                        You are signed in as <strong>{authUser.username}</strong>, but only administrators
                        can view validation logs and exports.
                    </p>
                </div>
            </article>
        );
    }

    // Admin user - show dashboard
    return (
        <article className="card tall">
            <div className="card-head">
                <div>
                    <p className="eyebrow">Admin Dashboard</p>
                    <h2>Validation Logs & Export</h2>
                </div>
                <span className="badge">Authorized</span>
            </div>

            <div className="admin-controls">
                <button className="btn ghost" onClick={onRefresh} disabled={adminLoading}>
                    {adminLoading ? 'Loading...' : 'Refresh Data'}
                </button>
                <a className="btn primary" href={exportHref} target="_blank" rel="noreferrer">
                    Export CSV
                </a>
            </div>

            {adminError && (
                <div className="result status-error">
                    {adminError}
                </div>
            )}

            {adminStats && (
                <div className="stat-cards">
                    <div className="stat-card">
                        <p className="muted tiny">Total</p>
                        <h3>{adminStats.total}</h3>
                    </div>
                    <div className="stat-card">
                        <p className="muted tiny">Deliverable</p>
                        <h3 className="status-ok">{adminStats.deliverable}</h3>
                    </div>
                    <div className="stat-card">
                        <p className="muted tiny">Undeliverable</p>
                        <h3 className="status-error">{adminStats.undeliverable}</h3>
                    </div>
                    <div className="stat-card">
                        <p className="muted tiny">Invalid</p>
                        <h3 className="status-error">{adminStats.invalid}</h3>
                    </div>
                    <div className="stat-card">
                        <p className="muted tiny">Bounce Risk</p>
                        <h3 className="status-unknown">{adminStats.bounce_likely}</h3>
                    </div>
                </div>
            )}

            {adminStats && adminStats.recent && adminStats.recent.length > 0 && (
                <div className="recent-wrap">
                    <p className="eyebrow">Recent Activity</p>
                    <ul className="recent-list">
                        {adminStats.recent.map((row, idx) => (
                            <li key={idx}>
                                <span>{row.email}</span>
                                <span>
                                    {row.validation_status}
                                    {row.validation_reason ? ` (${row.validation_reason})` : ''}
                                </span>
                                <span className="muted tiny">{row.created_at || ''}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Bounce</th>
                            <th>MX</th>
                            <th>Opened</th>
                            <th>Clicked</th>
                            <th>Unsub</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {adminData && adminData.data.length === 0 && (
                            <tr>
                                <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '40px' }}>
                                    No validation records yet.
                                </td>
                            </tr>
                        )}
                        {adminData &&
                            adminData.data.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.email}</td>
                                    <td>
                                        {row.validation_status}
                                        {row.validation_reason ? ` (${row.validation_reason})` : ''}
                                    </td>
                                    <td>{bounceLabel(row)}</td>
                                    <td>{row.domain_has_mx ? 'Yes' : 'No'}</td>
                                    <td>{row.opened === true ? 'Yes' : row.opened === false ? 'No' : '—'}</td>
                                    <td>{row.clicked === true ? 'Yes' : row.clicked === false ? 'No' : '—'}</td>
                                    <td>{row.unsubscribed === true ? 'Yes' : row.unsubscribed === false ? 'No' : '—'}</td>
                                    <td>{row.created_at || ''}</td>
                                </tr>
                            ))}
                        {!adminData && (
                            <tr>
                                <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '40px' }}>
                                    {adminLoading ? 'Loading validation data...' : 'No data loaded yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {adminData && (
                <p className="muted tiny" style={{ marginTop: '16px', textAlign: 'center' }}>
                    Showing {adminData.data.length} of {adminData.total} records
                </p>
            )}
        </article>
    );
};
