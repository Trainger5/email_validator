import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'admin' | 'user';
    authUser: { username: string; role: string } | null;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requiredRole,
    authUser,
}) => {
    // Not authenticated - redirect to login
    if (!authUser) {
        return <Navigate to="/login" replace />;
    }

    // Authenticated but insufficient role
    if (requiredRole === 'admin' && authUser.role !== 'admin') {
        return <Navigate to="/dashboard" replace />;
    }

    // Authorized - render the protected content
    return <>{children}</>;
};
