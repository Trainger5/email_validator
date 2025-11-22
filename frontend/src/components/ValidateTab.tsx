import React from 'react';
import { ValidationResult } from '../api';

interface ValidateTabProps {
    email: string;
    result: ValidationResult | null;
    error: string | null;
    loading: boolean;
    onEmailChange: (value: string) => void;
    onValidate: () => void;
}

function bounceLabel(res: { bounce_likely?: boolean | null; bounce_reason?: string | null }) {
    if (res.bounce_likely === true) return `Likely${res.bounce_reason ? ` (${res.bounce_reason})` : ''}`;
    if (res.bounce_likely === false) return 'Unlikely';
    return 'Unknown';
}

export const ValidateTab: React.FC<ValidateTabProps> = ({
    email,
    result,
    error,
    loading,
    onEmailChange,
    onValidate,
}) => {
    const getStatusClass = () => {
        if (!result) return 'status-unknown';
        if (result.status === 'deliverable') return 'status-ok';
        if (result.status === 'undeliverable' || result.status === 'invalid_domain' || result.status === 'invalid_syntax')
            return 'status-error';
        return 'status-unknown';
    };

    return (
        <article className="card tall">
            <div className="card-head">
                <div>
                    <p className="eyebrow">Single Validation</p>
                    <h2>Instant Deliverability Check</h2>
                </div>
                <span className="badge">Real-time</span>
            </div>

            <label className="input-label">Email Address</label>
            <input
                className="input"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onValidate()}
            />

            <button className="btn primary block" disabled={loading} onClick={onValidate}>
                {loading ? 'Validating...' : 'Validate Email'}
            </button>

            <div className={`result ${getStatusClass()}`}>
                {error ? (
                    `Error: ${error}`
                ) : result ? (
                    <>
                        {`Email: ${result.email}`}
                        {`\nStatus: ${result.status}${result.reason ? ` (${result.reason})` : ''}`}
                        {`\nBounce Risk: ${bounceLabel(result)}`}
                        {`\nDeliverable: ${result.is_deliverable ? 'Yes' : 'No'}`}
                        {`\nMX Records: ${result.domain_has_mx ? 'Found' : 'Not Found'}`}
                        {`\nSMTP: ${result.smtp_connectable ? 'Reachable' : 'Unreachable'}`}
                        {result.record_id ? `\nRecord ID: #${result.record_id}` : ''}
                    </>
                ) : (
                    'Enter an email address and click validate to see results...'
                )}
            </div>
        </article>
    );
};
