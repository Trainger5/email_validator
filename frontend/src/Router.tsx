import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ValidationPage } from './pages/ValidationPage';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

interface AppRouterProps {
    authUser: { username: string; role: string } | null;
    onLogin: (user: { username: string; role: string }) => void;
    onLogout: () => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({ authUser, onLogin, onLogout }) => {
    return (
        <BrowserRouter>
            <div className="app-container">
                <Navigation authUser={authUser} onLogout={onLogout} />

                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
                    <Route path="/signup" element={<SignupPage />} />

                    {/* Protected Routes */}
                    <Route
                        path="/validate"
                        element={
                            <ProtectedRoute authUser={authUser}>
                                <ValidationPage authUser={authUser!} />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute authUser={authUser}>
                                <UserDashboard authUser={authUser!} />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute authUser={authUser} requiredRole="admin">
                                <AdminDashboard authUser={authUser!} />
                            </ProtectedRoute>
                        }
                    />

                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
};
