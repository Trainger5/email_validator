import React, { useState, useMemo } from 'react';
import { BulkResponse } from '../api';

interface ResultsViewProps {
    results: BulkResponse['results'];
    summary: BulkResponse['summary'];
}

type DataCategory = 'valid' | 'unknown' | 'invalid';

const ITEMS_PER_PAGE = 10;

export const ResultsView: React.FC<ResultsViewProps> = ({ results, summary }) => {
    if (!results || results.length === 0) return null;

    // Split into 3 categories based on validation logic
    const validEmails = useMemo(() => results.filter(r => r.status === 'deliverable'), [results]);
    const invalidEmails = useMemo(() =>
        results.filter(r => r.status !== 'deliverable' && r.bounce_likely === true),
        [results]
    );
    const unknownEmails = useMemo(() =>
        results.filter(r => r.status !== 'deliverable' && r.bounce_likely !== true),
        [results]
    );

    const TableSection = ({
        data,
        title,
        icon,
        iconColor,
        category
    }: {
        data: typeof results;
        title: string;
        icon: string;
        iconColor: string;
        category: DataCategory;
    }) => {
        const [searchTerm, setSearchTerm] = useState('');
        const [currentPage, setCurrentPage] = useState(1);

        const filteredData = useMemo(() => {
            if (!searchTerm) return data;
            return data.filter(r =>
                r.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }, [data, searchTerm]);

        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        const paginatedData = useMemo(() => {
            const start = (currentPage - 1) * ITEMS_PER_PAGE;
            return filteredData.slice(start, start + ITEMS_PER_PAGE);
        }, [filteredData, currentPage]);

        const downloadCSV = () => {
            const headers = ['Email', 'Status', 'Reason', 'MX', 'SMTP', 'Bounce Risk'];
            const rows = filteredData.map(r => [
                r.email,
                r.status,
                r.reason || '',
                r.domain_has_mx ? 'Yes' : 'No',
                r.smtp_connectable ? 'Yes' : 'No',
                r.bounce_likely ? 'Yes' : 'No'
            ]);

            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${category}_emails_${new Date().toISOString().split('T')[0]}.csv`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
        };

        const StatusBadge = ({ status, reason }: { status: string; reason?: string | null }) => {
            let className = 'badge-status neutral';
            let label = status;

            if (status === 'deliverable') {
                className = 'badge-status success';
                label = 'Valid';
            } else if (['undeliverable', 'invalid_syntax', 'invalid_domain'].includes(status)) {
                className = 'badge-status error';
                label = 'Invalid';
            } else {
                label = 'Unknown';
            }

            return (
                <span className={className} title={reason || status}>
                    {status === 'deliverable' && <i className="fas fa-check-circle"></i>}
                    {status !== 'deliverable' && status !== 'unknown' && <i className="fas fa-exclamation-circle"></i>}
                    {label}
                </span>
            );
        };

        if (data.length === 0) return null;

        return (
            <div className="result-section" style={{ marginBottom: '3rem' }}>
                <div className="table-header">
                    <h3>
                        <i className={icon} style={{ color: iconColor }}></i>
                        {title}
                        <span className="badge-status neutral">{data.length}</span>
                    </h3>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Filter emails..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="input"
                            style={{ width: '200px', padding: '0.5rem', fontSize: '0.85rem' }}
                        />
                        <button className="btn primary tiny-btn" onClick={downloadCSV}>
                            <i className="fas fa-download"></i> Download CSV
                        </button>
                    </div>
                </div>

                <div className="glass-panel" style={{ overflowX: 'auto' }}>
                    <table className="table-glass">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '200px' }}>Email</th>
                                <th>Status</th>
                                <th>Reason</th>
                                <th>MX</th>
                                <th>SMTP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((r, i) => (
                                <tr key={i}>
                                    <td style={{
                                        maxWidth: '300px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }} title={r.email}>{r.email}</td>
                                    <td><StatusBadge status={r.status} reason={r.reason} /></td>
                                    <td className="muted" style={{ fontSize: '0.85rem' }}>{r.reason || '-'}</td>
                                    <td>{r.domain_has_mx ? 'Yes' : 'No'}</td>
                                    <td>{r.smtp_connectable ? 'Yes' : 'No'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="pagination-controls">
                        <button
                            className="btn ghost tiny-btn"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <i className="fas fa-chevron-left"></i> Previous
                        </button>
                        <span className="pagination-info">
                            Page {currentPage} of {totalPages} ({filteredData.length} results)
                        </span>
                        <button
                            className="btn ghost tiny-btn"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="result-container">
            {/* Summary Cards */}
            <div className="summary-grid" style={{ marginBottom: '2rem' }}>
                <div className="summary-card">
                    <p className="tiny muted">Total Processed</p>
                    <h3>{results.length}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Emails</span>
                </div>
                <div className="summary-card success">
                    <p className="tiny muted">Valid</p>
                    <h3>{validEmails.length}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                        {results.length > 0 ? Math.round((validEmails.length / results.length) * 100) : 0}%
                    </span>
                </div>
                <div className="summary-card warning">
                    <p className="tiny muted">Unknown</p>
                    <h3>{unknownEmails.length}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>
                        {results.length > 0 ? Math.round((unknownEmails.length / results.length) * 100) : 0}%
                    </span>
                </div>
                <div className="summary-card danger">
                    <p className="tiny muted">Invalid</p>
                    <h3>{invalidEmails.length}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>
                        {results.length > 0 ? Math.round((invalidEmails.length / results.length) * 100) : 0}%
                    </span>
                </div>
            </div>

            <TableSection
                data={validEmails}
                title="Valid Emails"
                icon="fas fa-check-circle"
                iconColor="var(--success)"
                category="valid"
            />

            <TableSection
                data={unknownEmails}
                title="Unknown Emails"
                icon="fas fa-question-circle"
                iconColor="var(--warning)"
                category="unknown"
            />

            <TableSection
                data={invalidEmails}
                title="Invalid Emails"
                icon="fas fa-times-circle"
                iconColor="var(--error)"
                category="invalid"
            />
        </div>
    );
};
