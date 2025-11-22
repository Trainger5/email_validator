import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const SignupPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            // Note: If backend doesn't have signup endpoint, this will redirect to login
            // with a message to use existing credentials

            // Simulate signup (replace with actual API call when available)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // For now, redirect to login with success message
            navigate('/login', {
                state: {
                    message: 'Account created! Please sign in with your credentials. (Demo: Use admin/admin123)'
                }
            });
        } catch (err: any) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Create Account</h1>
                        <p>Get started with email validation</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="input-label">Username</label>
                            <input
                                className="input"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Choose a username"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Email</label>
                            <input
                                className="input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Password</label>
                            <input
                                className="input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Confirm Password</label>
                            <input
                                className="input"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat your password"
                                required
                            />
                        </div>

                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        <button type="submit" className="btn primary block large" disabled={loading}>
                            {loading ? 'Creating account...' : 'Sign Up'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            Already have an account?{' '}
                            <Link to="/login" className="auth-link">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="auth-side">
                    <h2>Why Choose Us?</h2>
                    <ul className="auth-benefits">
                        <li>Validate unlimited emails</li>
                        <li>99.9% accuracy rate</li>
                        <li>Lightning-fast bulk processing</li>
                        <li>Detailed validation reports</li>
                        <li>Secure and private</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
