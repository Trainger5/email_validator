import React from 'react';

interface SidebarProps {
    authUser: { username: string; role: string } | null;
    loginUsername: string;
    loginPassword: string;
    loginError: string | null;
    loginLoading: boolean;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onLogin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    authUser,
    loginUsername,
    loginPassword,
    loginError,
    loginLoading,
    onUsernameChange,
    onPasswordChange,
    onLogin,
}) => {
    return (
        <aside className="workspace-aside">
            <div className="aside-card">
                <p className="eyebrow">Authentication</p>
                {authUser ? (
                    <div className="auth-status">
                        <p className="muted">Signed in as</p>
                        <h3>{authUser.username}</h3>
                        <span className={`role-pill ${authUser.role === 'admin' ? 'admin' : 'user'}`}>
                            {authUser.role}
                        </span>
                    </div>
                ) : (
                    <>
                        <label className="input-label">Username</label>
                        <input
                            className="input"
                            value={loginUsername}
                            onChange={(e) => onUsernameChange(e.target.value)}
                            placeholder="admin"
                            onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                        />
                        <label className="input-label">Password</label>
                        <input
                            className="input"
                            type="password"
                            value={loginPassword}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            placeholder="•••••••"
                            onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                        />
                        <button className="btn primary block" onClick={onLogin} disabled={loginLoading}>
                            {loginLoading ? 'Signing in...' : 'Sign in'}
                        </button>
                        {loginError && <div className="result status-error">{loginError}</div>}
                        <p className="muted tiny">Default credentials: admin / admin123</p>
                    </>
                )}
            </div>

            <div className="aside-card">
                <p className="eyebrow">API Endpoints</p>
                <ul>
                    <li><code>/validate</code> — Single validation</li>
                    <li><code>/validate/bulk</code> — Bulk validation</li>
                    <li><code>/validate/upload</code> — File upload</li>
                    <li><code>/template/csv</code> & <code>/template/excel</code></li>
                    <li><code>/admin/validations</code> & <code>/admin/export</code></li>
                    <li><code>/auth/login</code> & <code>/auth/me</code></li>
                </ul>
            </div>

            <div className="aside-card">
                <p className="eyebrow">Bounce Detection</p>
                <p className="muted tiny">
                    Bounce risk is inferred from SMTP RCPT responses, MX reachability, and hard failures.
                    Catch-all and disposable domains are flagged for risk scoring.
                </p>
            </div>
        </aside>
    );
};
