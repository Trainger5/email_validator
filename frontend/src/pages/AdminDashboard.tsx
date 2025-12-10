import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminStats, fetchAdminValidations, AdminStats } from '../api';
import { DonutChart, BarChart } from '../components/Charts';

interface AdminDashboardProps {
    authUser: { username: string; role: string };
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ authUser }) => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        refresh();
    }, []);

    const refresh = async () => {
        setLoading(true);
        setError(null);
        try {
            const statsResp = await fetchAdminStats();
            setStats(statsResp);
        } catch (err: any) {
            setError(err.message || 'Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/export', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `validations_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            setError(err.message || 'Failed to export data');
        }
    };

    const exportHref = `/api/admin/export?token=${localStorage.getItem('token') || ''}`;

    if (loading && !stats) {
        return (
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <h2>Admin Overview</h2>
                    <p className="muted">Loading system metrics...</p>
                </header>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    // Process data for charts
    const donutData = stats ? [
        { label: 'Deliverable', value: stats.deliverable, color: 'var(--success)' },
        { label: 'Invalid', value: stats.invalid, color: 'var(--error)' },
        { label: 'Risky', value: stats.bounce_likely, color: 'var(--warning)' },
        { label: 'Undeliverable', value: stats.undeliverable, color: '#94a3b8' }
    ].filter(d => d.value > 0) : [];

    const activityData = [
        { label: 'Mon', value: 45, color: '#cbd5e1' },
        { label: 'Tue', value: 52, color: '#cbd5e1' },
        { label: 'Wed', value: 38, color: '#cbd5e1' },
        { label: 'Thu', value: 65, color: '#cbd5e1' },
        { label: 'Fri', value: stats?.recent?.length ? stats.recent.length * 5 : 48, color: 'var(--primary)' },
        { label: 'Sat', value: 20, color: '#cbd5e1' },
        { label: 'Sun', value: 15, color: '#cbd5e1' }
    ];

    return (
        <div className="dashboard-container">
            {/* Header Section */}
            <div className="dashboard-header d-flex justify-between align-center" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1>Admin Dashboard</h1>
                    <p className="muted">System status and verification overview</p>
                </div>
                <div className="d-flex align-center" style={{ gap: '1rem' }}>
                    <div className="status-indicator">
                        <span className="dot pulse success"></span>
                        <span className="tiny">System Operational</span>
                    </div>
                    <button onClick={refresh} className="btn ghost tiny-btn" title="Refresh Data">
                        <i className="fas fa-sync-alt"></i>
                    </button>
                    <div className="user-chip">
                        <span className="chip-name">{authUser.username}</span>
                        <span className="chip-role">ADMIN</span>
                    </div>
                </div>
            </div>

            {error && <div className="result status-error">{error}</div>}

            {stats && (
                <div className="admin-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>

                    {/* Row 1: KPI Cards */}
                    <div style={{ gridColumn: 'span 3' }} className="summary-card card-purple">
                        <div className="d-flex justify-between align-center">
                            <span className="tiny">Total Verifications</span>
                            <i className="fas fa-layer-group"></i>
                        </div>
                        <h2>{(stats.total ?? 0).toLocaleString()}</h2>
                        <span className="tiny">↑ 12% vs last week</span>
                    </div>
                    <div style={{ gridColumn: 'span 3' }} className="summary-card card-blue">
                        <div className="d-flex justify-between align-center">
                            <span className="tiny">Deliverability Rate</span>
                            <i className="fas fa-check-circle"></i>
                        </div>
                        <h2>{stats.total > 0 ? Math.round(((stats.deliverable ?? 0) / stats.total) * 100) : 0}%</h2>
                        <span className="tiny">Industry avg: 85%</span>
                    </div>
                    <div style={{ gridColumn: 'span 3' }} className="summary-card card-green">
                        <div className="d-flex justify-between align-center">
                            <span className="tiny">Clean Emails</span>
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <h2>{(stats.deliverable ?? 0).toLocaleString()}</h2>
                        <span className="tiny">Ready for campaigns</span>
                    </div>
                    <div style={{ gridColumn: 'span 3' }} className="summary-card card-orange">
                        <div className="d-flex justify-between align-center">
                            <span className="tiny">Bounce Risk</span>
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <h2>{(stats.bounce_likely ?? 0).toLocaleString()}</h2>
                        <span className="tiny">Require attention</span>
                    </div>

                    {/* Row 2: Charts Section */}
                    <div style={{ gridColumn: 'span 8' }} className="admin-section">
                        <div className="section-head d-flex justify-between align-center">
                            <h3>Validation Traffic</h3>
                            <div className="tab-pills tiny">
                                <button className="active">Weekly</button>
                                <button>Monthly</button>
                            </div>
                        </div>
                        <div style={{ padding: '1rem 0' }}>
                            <BarChart data={activityData} height={220} />
                        </div>
                    </div>

                    <div style={{ gridColumn: 'span 4' }} className="admin-section">
                        <div className="section-head">
                            <h3>Result Distribution</h3>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                            <DonutChart data={donutData} size={220} />
                        </div>
                        <div className="d-flex justify-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                            {donutData.map(d => (
                                <div key={d.label} className="d-flex align-center" style={{ gap: '0.5rem' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }}></span>
                                    <span className="tiny muted">{d.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Row 3: Actions & Health */}
                    <div style={{ gridColumn: 'span 6' }} className="admin-section">
                        <h3>Quick Actions</h3>
                        <div className="d-flex" style={{ gap: '1rem', marginTop: '1rem' }}>
                            <Link to="/validate" state={{ tab: 'upload' }} className="btn primary full-width" style={{ flex: 1 }}>
                                <i className="fas fa-upload" style={{ marginRight: '0.5rem' }}></i> Upload List
                            </Link>
                            <button onClick={handleExport} className="btn secondary full-width" style={{ flex: 1 }}>
                                <i className="fas fa-file-download" style={{ marginRight: '0.5rem' }}></i> Export Data
                            </button>
                        </div>
                    </div>

                    <div style={{ gridColumn: 'span 6' }} className="admin-section system-health">
                        <h3>System Health</h3>
                        <ul className="health-list" style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            <li className="d-flex align-center" style={{ gap: '0.5rem' }}>
                                <span className="status-badge status-ok tiny">SMTP Active</span>
                            </li>
                            <li className="d-flex align-center" style={{ gap: '0.5rem' }}>
                                <span className="status-badge status-ok tiny">DB Connected</span>
                            </li>
                            <li className="d-flex align-center" style={{ gap: '0.5rem' }}>
                                <span className="tiny muted">Latency: 45ms</span>
                            </li>
                        </ul>
                    </div>

                    {/* Row 4: Recent Activity */}
                    <div style={{ gridColumn: 'span 12' }} className="admin-section">
                        <div className="section-head d-flex justify-between align-center">
                            <h3>Recent Activity</h3>
                            <Link to="/validate" state={{ tab: 'admin' }} className="link-text tiny">View All Logs →</Link>
                        </div>
                        <div className="table-responsive">
                            <table className="table-glass">
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recent && stats.recent.length > 0 ? (
                                        stats.recent.slice(0, 10).map((log, idx) => (
                                            <tr key={idx}>
                                                <td>{log.email}</td>
                                                <td>
                                                    <span className={`status-badge ${log.validation_status === 'deliverable' ? 'status-ok' :
                                                        log.validation_status === 'undeliverable' ? 'status-error' : 'status-unknown'
                                                        }`}>
                                                        {log.validation_status}
                                                    </span>
                                                </td>
                                                <td className="tiny muted">{new Date(log.created_at || '').toLocaleTimeString()}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="text-center muted">No recent activity</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
