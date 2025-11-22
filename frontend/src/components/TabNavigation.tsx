import React from 'react';

type Tab = 'single' | 'bulk' | 'upload' | 'admin';

interface TabNavigationProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    authUser: { username: string; role: string } | null;
    onLogout: () => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
    activeTab,
    onTabChange,
    authUser,
    onLogout,
}) => {
    const tabs: Array<[Tab, string]> = [
        ['single', 'Validate'],
        ['bulk', 'Bulk Paste'],
        ['upload', 'Upload'],
        ['admin', 'Admin'],
    ];

    return (
        <nav className="tabs">
            {tabs.map(([key, label]) => (
                <button
                    key={key}
                    className={`tab ${activeTab === key ? 'active' : ''}`}
                    onClick={() => onTabChange(key)}
                >
                    {label}
                </button>
            ))}

            <div className="auth-chip">
                {authUser ? (
                    <>
                        <span>
                            <strong>{authUser.username}</strong>
                            <span className="role-badge">{authUser.role}</span>
                        </span>
                        <button className="btn ghost tiny-btn" onClick={onLogout}>
                            Logout
                        </button>
                    </>
                ) : (
                    <span className="muted">Not signed in</span>
                )}
            </div>
        </nav>
    );
};
