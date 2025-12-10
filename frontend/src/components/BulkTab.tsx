import React from 'react';
import { BulkResponse } from '../api';
import { ResultsView } from './ResultsView';

interface BulkTabProps {
    input: string;
    response: BulkResponse | null;
    error: string | null;
    loading: boolean;
    onInputChange: (value: string) => void;
    onValidate: () => void;
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
        <>
            <article className="card">
                <div className="card-head d-flex justify-between align-center" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div>
                        <p className="eyebrow">Bulk Validation</p>
                        <h2>Scan Multiple Emails</h2>
                    </div>
                    <span className="badge">Async Process</span>
                </div>

                <p className="muted" style={{ marginTop: '1rem' }}>
                    Enter one email per line. Lines starting with <code>#</code> are ignored.
                </p>

                <textarea
                    className="textarea"
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    placeholder="user1@example.com&#10;user2@example.com&#10;# This is a comment&#10;user3@example.com"
                    style={{ marginTop: '1.5rem' }}
                />

                <button className="btn primary block" disabled={loading} onClick={onValidate}>
                    {loading ? (
                        <><i className="fas fa-circle-notch fa-spin"></i> Processing...</>
                    ) : (
                        <><i className="fas fa-layer-group"></i> Bulk Validate</>
                    )}
                </button>
            </article>

            {error && (
                <div className="result-container animate-fade-in">
                    <div className="result-card-single invalid">
                        <div className="result-header">
                            <div className="result-icon"><i className="fas fa-exclamation-triangle"></i></div>
                            <div>
                                <h3>Error</h3>
                                <p className="muted">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {response && (
                <div className="animate-slide-up">
                    <ResultsView results={response.results} summary={response.summary} />
                </div>
            )}
        </>
    );
};
