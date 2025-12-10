import React from 'react';

type TabKey = 'single' | 'bulk' | 'upload' | 'admin';

interface TabNavigationProps {
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    authUser: { username: string; role: string } | null;
    onLogout: () => void;
}

const TABS: Array<{ key: TabKey; label: string; requiresAdmin?: boolean }> = [
    { key: 'single', label: 'Single' },
    { key: 'bulk', label: 'Bulk' },
    { key: 'upload', label: 'Upload' },
    { key: 'admin', label: 'Admin', requiresAdmin: true },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, authUser, onLogout }) => {
    return (
        <div className="simple-tabs">
            <div className="tab-buttons">
                {TABS.map((tab) => {
                    const disabled = tab.requiresAdmin && authUser?.role !== 'admin';
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            className={`simple-tab ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => !disabled && onTabChange(tab.key)}
                            disabled={disabled}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* <div className="tab-user">
                {authUser ? (
                    <>
                        <span>
                            {authUser.username} <small>{authUser.role}</small>
                        </span>
                        <button className="btn ghost tiny-btn" onClick={onLogout}>
                            Logout
                        </button>
                    </>
                ) : (
                    <span className="muted">Not signed in</span>
                )}
            </div> */}
        </div>
    );
};
