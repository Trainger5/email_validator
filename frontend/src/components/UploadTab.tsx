import React from 'react';
import { BulkResponse } from '../api';
import { ResultsView } from './ResultsView';

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
        <>
            <article className="card">
                <div className="card-head d-flex justify-between align-center" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div>
                        <p className="eyebrow">File Upload</p>
                        <h2>CSV / Excel Validation</h2>
                    </div>
                    <span className="badge">Stored</span>
                </div>

                <p className="muted" style={{ marginTop: '1rem' }}>
                    Use the template headers. All uploads are automatically stored and viewable in the admin console.
                </p>

                <div className="upload-row" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="input-label">Select File</label>
                        <input
                            className="input file"
                            type="file"
                            accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                            style={{ paddingTop: '0.6rem' }}
                        />
                    </div>
                    <div style={{ width: '120px' }}>
                        <label className="input-label">Concurrency</label>
                        <input
                            className="input number"
                            type="number"
                            min={1}
                            max={25}
                            value={concurrency}
                            onChange={(e) => onConcurrencyChange(Number(e.target.value) || 5)}
                        />
                    </div>
                </div>

                {file && (
                    <div className="file-info" style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.9rem' }}>
                        <i className="fas fa-file-alt" style={{ marginRight: '8px' }}></i>
                        Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                    </div>
                )}

                <button className="btn primary block" disabled={loading} onClick={onUpload}>
                    {loading ? (
                        <><i className="fas fa-circle-notch fa-spin"></i> Uploading & Processing...</>
                    ) : (
                        <><i className="fas fa-cloud-upload-alt"></i> Upload & Validate</>
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
