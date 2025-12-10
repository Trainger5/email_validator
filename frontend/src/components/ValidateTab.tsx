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
        if (!result) return 'unknown';
        if (result.status === 'deliverable') return 'valid';
        if (['undeliverable', 'invalid_syntax', 'invalid_domain'].includes(result.status))
            return 'invalid';
        return 'unknown';
    };

    return (
        <>
            <article className="card">
                <div className="card-head d-flex justify-between align-center" style={{ borderBottom: 'none', paddingBottom: 0 }}>
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
                    {loading ? (
                        <><i className="fas fa-circle-notch fa-spin"></i> Validating...</>
                    ) : (
                        <><i className="fas fa-search"></i> Validate Email</>
                    )}
                </button>
            </article>

            {/* Error Message */}
            {error && (
                <div className="result-container animate-fade-in">
                    <div className="result-card-single invalid">
                        <div className="result-header">
                            <div className="result-icon">
                                <i className="fas fa-exclamation-triangle"></i>
                            </div>
                            <div>
                                <h3>Validation Error</h3>
                                <p className="muted">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Result */}
            {result && (
                <div className="result-container animate-slide-up">
                    <div className={`result-card-single ${getStatusClass()}`}>
                        <div className="result-header">
                            <div className="result-icon">
                                {getStatusClass() === 'valid' && <i className="fas fa-check"></i>}
                                {getStatusClass() === 'invalid' && <i className="fas fa-times"></i>}
                                {getStatusClass() === 'unknown' && <i className="fas fa-question"></i>}
                            </div>
                            <div>
                                <h3 style={{ textTransform: 'capitalize' }}>{result.status.replace('_', ' ')}</h3>
                                <p className="muted">{result.reason || 'Validation completed successfully'}</p>
                            </div>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Email</label>
                                <span>{result.email}</span>
                            </div>
                            <div className="detail-item">
                                <label>Deliverable</label>
                                <span>{result.is_deliverable ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="detail-item">
                                <label>Bounce Risk</label>
                                <span>{bounceLabel(result)}</span>
                            </div>
                            <div className="detail-item">
                                <label>MX Record</label>
                                <span>{result.domain_has_mx ? 'Found' : 'Missing'}</span>
                            </div>
                            <div className="detail-item">
                                <label>SMTP Connection</label>
                                <span>{result.smtp_connectable ? 'Success' : 'Failed'}</span>
                            </div>
                            <div className="detail-item">
                                <label>Disposable</label>
                                <span>{result.is_disposable ? 'Yes' : 'No'}</span>
                            </div>
                            {result.record_id && (
                                <div className="detail-item">
                                    <label>Record ID</label>
                                    <span>#{result.record_id}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
