import React from 'react';
import { Link } from 'react-router-dom';

interface NavigationProps {
    authUser: { username: string; role: string } | null;
    onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ authUser, onLogout }) => {
    return (
        <nav className="main-nav">
            <div className="nav-container">
                <Link to="/" className="nav-brand">
                    <span className="brand-icon">✓</span>
                    <span className="brand-text">Email Validator</span>
                </Link>

                <div className="nav-links">
                    {authUser ? (
                        <>
                            <Link to="/validate" className="nav-link">
                                Validate
                            </Link>

                            {authUser.role === 'admin' ? (
                                <Link to="/admin" className="nav-link">
                                    Admin Dashboard
                                </Link>
                            ) : (
                                <Link to="/dashboard" className="nav-link">
                                    Dashboard
                                </Link>
                            )}

                            <div className="nav-user">
                                <span className="user-name">{authUser.username}</span>
                                <span className="user-role">{authUser.role}</span>
                            </div>

                            <button className="btn ghost tiny-btn" onClick={onLogout}>
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn ghost">
                                Login
                            </Link>
                            <Link to="/signup" className="btn primary">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};
