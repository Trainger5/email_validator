import React from 'react';
import { BulkResponse } from '../api';

interface BulkTabProps {
    input: string;
    response: BulkResponse | null;
    error: string | null;
    loading: boolean;
    onInputChange: (value: string) => void;
    onValidate: () => void;
}

const MAX_INLINE_RESULTS = 15;

function bounceLabel(res: { bounce_likely?: boolean | null; bounce_reason?: string | null }) {
    if (res.bounce_likely === true) return `Likely${res.bounce_reason ? ` (${res.bounce_reason})` : ''}`;
    if (res.bounce_likely === false) return 'Unlikely';
    return 'Unknown';
}

function renderBulkSummary(res: BulkResponse) {
    const summary = res.summary || {};
    const results = res.results || [];
    const lines = [
        `Total Processed: ${res.total ?? results.length}`,
        `Deliverable: ${summary.deliverable ?? 0}`,
        `Undeliverable: ${summary.undeliverable ?? 0}`,
        `Invalid: ${summary.invalid ?? 0}`,
        `Unknown: ${summary.unknown ?? 0}`,
        '',
        'Sample Results:',
        '─'.repeat(60),
    ];

    results.slice(0, MAX_INLINE_RESULTS).forEach((r, idx) => {
        const email = r.email || r.input?.email || '?';
        const status = r.status || 'unknown';
        const reason = r.reason ? ` (${r.reason})` : '';
        const bounce = bounceLabel(r);
        const recordId = r.record_id ? ` [#${r.record_id}]` : '';
        lines.push(`${idx + 1}. ${email} → ${status}${reason} | Bounce: ${bounce}${recordId}`);
    });

    if (results.length > MAX_INLINE_RESULTS) {
        lines.push(`\n... and ${results.length - MAX_INLINE_RESULTS} more results`);
    }

    return lines.join('\n');
}

export const BulkTab: React.FC<BulkTabProps> = ({
    input,
    response,
    error,
    loading,
    onInputChange,
    onValidate,
}) => {
    return (
        <article className="card tall">
            <div className="card-head">
                <div>
                    <p className="eyebrow">Bulk Validation</p>
                    <h2>Scan Multiple Emails</h2>
                </div>
                <span className="badge">Async Process</span>
            </div>

            <p className="muted">
                Enter one email per line. Lines starting with <code>#</code> are ignored as comments.
            </p>

            <textarea
                className="textarea"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="user1@example.com&#10;user2@example.com&#10;# This is a comment&#10;user3@example.com"
            />

            <button className="btn primary block" disabled={loading} onClick={onValidate}>
                {loading ? 'Processing...' : 'Bulk Validate'}
            </button>

            <div className="result status-unknown">
                {error ? (
                    `Error: ${error}`
                ) : response ? (
                    renderBulkSummary(response)
                ) : (
                    'Paste email addresses above (one per line) and click validate...'
                )}
            </div>
        </article>
    );
};
