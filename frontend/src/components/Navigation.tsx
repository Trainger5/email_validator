import React from 'react';
import { Link } from 'react-router-dom';

interface NavigationProps {
    authUser: { username: string; role: string } | null;
    onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ authUser, onLogout }) => {
    return (
        <nav className="main-nav modern-nav">
            <div className="nav-wrap">
                <Link to="/" className="brand-block">
                    <span className="brand-mark">✓</span>
                    <div>
                        <span className="brand-title">Email Validator</span>
                    </div>
                </Link>

                <div className="nav-menu">
                    <Link to="/validate" className="nav-link">
                        Validate
                    </Link>
                    {authUser ? (
                        authUser.role === 'admin' ? (
                            <Link to="/admin" className="nav-link">
                                Admin
                            </Link>
                        ) : (
                            <Link to="/dashboard" className="nav-link">
                                Dashboard
                            </Link>
                        )
                    ) : (
                        <Link to="/" className="nav-link">
                            Product
                        </Link>
                    )}
                </div>

                <div className="nav-actions">
                    {authUser ? (
                        <>
                            <div className="user-chip">
                                <span className="chip-name">{authUser.username}</span>
                                <span className="chip-role">{authUser.role}</span>
                            </div>
                            <button className="btn ghost tiny-btn" onClick={onLogout}>
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="nav-pill ghost">
                                Login
                            </Link>
                            <Link to="/signup" className="nav-pill primary">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};
