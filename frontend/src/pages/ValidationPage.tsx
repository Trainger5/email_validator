import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    validateSingle,
    validateBulk,
    uploadFile,
    fetchAdminValidations,
    fetchAdminStats,
    templateUrl,
    ValidationResult,
    BulkResponse,
    AdminStats,
} from '../api';

import { TabNavigation, ValidateTab, BulkTab, UploadTab, AdminTab } from '../components';

type Tab = 'single' | 'bulk' | 'upload' | 'admin';

interface ValidationPageProps {
    authUser: { username: string; role: string };
}

export const ValidationPage: React.FC<ValidationPageProps> = ({ authUser }) => {
    const location = useLocation();
    const initialTab = (location.state as any)?.tab || 'single';

    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    // Single validation
    const [singleEmail, setSingleEmail] = useState('');
    const [singleResult, setSingleResult] = useState<ValidationResult | null>(null);
    const [singleError, setSingleError] = useState<string | null>(null);
    const [singleLoading, setSingleLoading] = useState(false);

    // Bulk validation
    const [bulkInput, setBulkInput] = useState('');
    const [bulkResponse, setBulkResponse] = useState<BulkResponse | null>(null);
    const [bulkError, setBulkError] = useState<string | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    // Upload validation
    const [uploadFile_, setUploadFile] = useState<File | null>(null);
    const [uploadConcurrency, setUploadConcurrency] = useState(5);
    const [uploadResponse, setUploadResponse] = useState<BulkResponse | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);

    // Admin data
    const [adminData, setAdminData] = useState<{ total: number; data: any[] } | null>(null);
    const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminError, setAdminError] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'admin' && authUser?.role === 'admin') {
            refreshAdminData();
        }
    }, [activeTab, authUser]);

    const doSingle = async () => {
        if (!singleEmail.trim()) return;
        setSingleLoading(true);
        setSingleError(null);
        setSingleResult(null);
        try {
            const data = await validateSingle(singleEmail);
            setSingleResult(data);
        } catch (err: any) {
            setSingleError(err.message || 'Validation failed');
        } finally {
            setSingleLoading(false);
        }
    };

    const doBulk = async () => {
        if (!bulkInput.trim()) return;
        setBulkLoading(true);
        setBulkError(null);
        setBulkResponse(null);
        try {
            // Split input by newlines and filter out empty lines and comments
            const emails = bulkInput
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            const data = await validateBulk(emails);
            setBulkResponse(data);
        } catch (err: any) {
            setBulkError(err.message || 'Bulk validation failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const doUpload = async () => {
        if (!uploadFile_) return;
        setUploadLoading(true);
        setUploadError(null);
        setUploadResponse(null);
        try {
            const data = await uploadFile(uploadFile_, uploadConcurrency);
            setUploadResponse(data);
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setUploadLoading(false);
        }
    };

    const refreshAdminData = async () => {
        setAdminLoading(true);
        setAdminError(null);
        try {
            const [validations, stats] = await Promise.all([
                fetchAdminValidations(),
                fetchAdminStats(),
            ]);
            setAdminData(validations);
            setAdminStats(stats);
        } catch (err: any) {
            setAdminError(err.message || 'Failed to load admin data');
        } finally {
            setAdminLoading(false);
        }
    };

    function renderTab() {
        switch (activeTab) {
            case 'single':
                return (
                    <ValidateTab
                        email={singleEmail}
                        result={singleResult}
                        error={singleError}
                        loading={singleLoading}
                        onEmailChange={setSingleEmail}
                        onValidate={doSingle}
                    />
                );

            case 'bulk':
                return (
                    <BulkTab
                        input={bulkInput}
                        response={bulkResponse}
                        error={bulkError}
                        loading={bulkLoading}
                        onInputChange={setBulkInput}
                        onValidate={doBulk}
                    />
                );

            case 'upload':
                return (
                    <UploadTab
                        file={uploadFile_}
                        concurrency={uploadConcurrency}
                        response={uploadResponse}
                        error={uploadError}
                        loading={uploadLoading}
                        onFileChange={setUploadFile}
                        onConcurrencyChange={setUploadConcurrency}
                        onUpload={doUpload}
                    />
                );

            case 'admin':
                return (
                    <AdminTab
                        authUser={authUser}
                        adminData={adminData}
                        adminStats={adminStats}
                        adminLoading={adminLoading}
                        adminError={adminError}
                        exportHref={`/api/admin/export?token=${localStorage.getItem('token') || ''}`}
                        onRefresh={refreshAdminData}
                    />
                );

            default:
                return null;
        }
    }

    return (
        <div className="validation-page">
            <div className="page">
                <div className="shell">
                    <TabNavigation
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        authUser={authUser}
                        onLogout={() => { }}
                    />
                </div>

                <div className="workspace">
                    <div className="workspace-main">
                        {renderTab()}
                    </div>
                </div>
            </div>
        </div>
    );
};
