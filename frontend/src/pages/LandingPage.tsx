import React from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
    return (
        <div className="landing-page">
            <section className="landing-hero">
                <div className="hero-container">
                    <div className="hero-text">
                        <h1 className="hero-title">
                            Professional Email Validation
                            <span className="hero-gradient"> for Your Business</span>
                        </h1>
                        <p className="hero-subtitle">
                            Real-time DNS and SMTP verification. Reduce bounce rates, protect your sender reputation,
                            and ensure your emails reach real inboxes.
                        </p>
                        <div className="hero-cta">
                            <Link to="/signup" className="btn primary large">
                                Get Started Free
                            </Link>
                            <Link to="/login" className="btn ghost large">
                                Sign In
                            </Link>
                        </div>
                        <p className="hero-note">
                            No credit card required • Instant setup • Free tier available
                        </p>
                    </div>

                    <div className="hero-visual">
                        <div className="feature-card">
                            <div className="feature-icon">✓</div>
                            <h3>99.9% Accuracy</h3>
                            <p>Industry-leading validation with DNS, MX, and SMTP checks</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">⚡</div>
                            <h3>Lightning Fast</h3>
                            <p>Validate thousands of emails in seconds with bulk processing</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🔒</div>
                            <h3>Secure & Private</h3>
                            <p>Your data is encrypted and never shared with third parties</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="landing-features">
                <div className="features-container">
                    <h2 className="section-title">Everything You Need</h2>
                    <p className="section-subtitle">
                        Powerful features to validate, verify, and manage your email lists
                    </p>

                    <div className="features-grid">
                        <div className="feature-item">
                            <h3>Real-Time Validation</h3>
                            <p>
                                Instant email verification with comprehensive DNS and SMTP checks.
                                Know immediately if an address is deliverable.
                            </p>
                        </div>

                        <div className="feature-item">
                            <h3>Bulk Processing</h3>
                            <p>
                                Upload CSV or Excel files to validate thousands of emails at once.
                                Perfect for cleaning your mailing lists.
                            </p>
                        </div>

                        <div className="feature-item">
                            <h3>Bounce Detection</h3>
                            <p>
                                Advanced algorithms predict bounce likelihood based on SMTP responses,
                                MX records, and domain health.
                            </p>
                        </div>

                        <div className="feature-item">
                            <h3>API Access</h3>
                            <p>
                                Integrate email validation directly into your applications with our
                                simple REST API.
                            </p>
                        </div>

                        <div className="feature-item">
                            <h3>Detailed Reports</h3>
                            <p>
                                Get comprehensive validation reports with bounce predictions,
                                domain analysis, and deliverability scores.
                            </p>
                        </div>

                        <div className="feature-item">
                            <h3>Admin Dashboard</h3>
                            <p>
                                Track usage, export data, and manage your team with powerful
                                admin tools and analytics.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="landing-cta">
                <div className="cta-container">
                    <h2>Ready to improve your email deliverability?</h2>
                    <p>Join thousands of businesses using our validation platform</p>
                    <Link to="/signup" className="btn primary large">
                        Start Validating Now
                    </Link>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="footer-container">
                    <p>&copy; 2025 Email Validator. Professional email validation service.</p>
                </div>
            </footer>
        </div>
    );
};
