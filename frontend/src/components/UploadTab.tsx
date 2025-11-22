import React from 'react';
import { BulkResponse } from '../api';

interface UploadTabProps {
    file: File | null;
    concurrency: number;
    response: BulkResponse | null;
    error: string | null;
    loading: boolean;
    onFileChange: (file: File | null) => void;
    onConcurrencyChange: (value: number) => void;
    onUpload: () => void;
}

const MAX_INLINE_RESULTS = 15;

function bounceLabel(res: { bounce_likely?: boolean | null; bounce_reason?: string | null }) {
    if (res.bounce_likely === true) return `Likely${res.bounce_reason ? ` (${res.bounce_reason})` : ''}`;
    if (res.bounce_likely === false) return 'Unlikely';
    return 'Unknown';
}

function renderUploadSummary(res: BulkResponse) {
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

export const UploadTab: React.FC<UploadTabProps> = ({
    file,
    concurrency,
    response,
    error,
    loading,
    onFileChange,
    onConcurrencyChange,
    onUpload,
}) => {
    return (
        <article className="card tall">
            <div className="card-head">
                <div>
                    <p className="eyebrow">File Upload</p>
                    <h2>CSV / Excel Validation</h2>
                </div>
                <span className="badge">Stored</span>
            </div>

            <p className="muted">
                Use the template headers. All uploads are automatically stored and viewable in the admin console.
            </p>

            <div className="upload-row">
                <input
                    className="input file"
                    type="file"
                    accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                    onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                />
                <label className="input-label inline">Concurrency</label>
                <input
                    className="input number"
                    type="number"
                    min={1}
                    max={25}
                    value={concurrency}
                    onChange={(e) => onConcurrencyChange(Number(e.target.value) || 5)}
                />
            </div>

            {file && (
                <div className="file-info">
                    Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                </div>
            )}

            <button className="btn primary block" disabled={loading} onClick={onUpload}>
                {loading ? 'Uploading & Processing...' : 'Upload & Validate'}
            </button>

            <div className="result status-unknown">
                {error ? (
                    `Error: ${error}`
                ) : response ? (
                    renderUploadSummary(response)
                ) : (
                    'Select a CSV or XLSX file and click upload to begin validation...'
                )}
            </div>
        </article>
    );
};
