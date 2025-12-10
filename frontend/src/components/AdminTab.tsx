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
                <div className="card-head d-flex justify-between align-center">
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
                <div className="card-head d-flex justify-between align-center">
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
            <div className="card-head d-flex justify-between align-center">
                <div>
                    <p className="eyebrow">Admin Dashboard</p>
                    <h2>Validation Logs & Export</h2>
                </div>
                <span className="badge">Authorized</span>
            </div>

            <div className="admin-controls d-flex justify-end">
                <button className="btn ghost" onClick={onRefresh} disabled={adminLoading}>
                    {adminLoading ? 'Loading...' : <i className="fas fa-sync-alt"></i>}
                </button>
                <a className="btn primary" href={exportHref} target="_blank" rel="noreferrer">
                    <i className="fa-solid fa-download"></i>
                </a>
            </div>

            {adminError && (
                <div className="result status-error">
                    {adminError}
                </div>
            )}


            {adminStats && (
                <div className="summary-grid" style={{ marginTop: '2rem' }}>
                    <div className="summary-card">
                        <p className="tiny muted">Total</p>
                        <h3>{adminStats.total}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Validated</span>
                    </div>
                    <div className="summary-card success">
                        <p className="tiny muted">Deliverable</p>
                        <h3>{adminStats.deliverable}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                            {adminStats.total > 0 ? Math.round((adminStats.deliverable / adminStats.total) * 100) : 0}%
                        </span>
                    </div>
                    <div className="summary-card danger">
                        <p className="tiny muted">Invalid</p>
                        <h3>{adminStats.invalid + adminStats.undeliverable}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>
                            Combined
                        </span>
                    </div>
                    <div className="summary-card warning">
                        <p className="tiny muted">Bounce Risk</p>
                        <h3>{adminStats.bounce_likely}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>
                            At Risk
                        </span>
                    </div>
                </div>
            )}


            {adminStats && adminStats.recent && adminStats.recent.length > 0 && (
                <div className="recent-wrap glass-panel" style={{ padding: '1.5rem', marginTop: '2rem' }}>
                    <p className="eyebrow">Recent Activity</p>
                    <ul className="recent-list" style={{ listStyle: 'none' }}>
                        {adminStats.recent.map((row, idx) => (
                            <li key={idx} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 500 }}>{row.email}</span>
                                <span className="muted">
                                    {row.validation_status}
                                    {row.validation_reason ? ` (${row.validation_reason})` : ''}
                                </span>
                                <span className="muted tiny">{row.created_at || ''}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="table-wrap" style={{ marginTop: '2rem' }}>
                <table className="table-glass">
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
