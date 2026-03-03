'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const { login, signup, user, loading } = useAuth();
    const router = useRouter();
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Redirect if already logged in
    if (!loading && user) {
        router.push('/');
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            if (isSignup) {
                if (!displayName.trim()) {
                    setError('Please enter your name.');
                    setSubmitting(false);
                    return;
                }
                await signup(email, password, displayName.trim());
            } else {
                await login(email, password);
            }
            router.push('/');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong';
            if (msg.includes('auth/email-already-in-use')) setError('This email is already registered. Please log in.');
            else if (msg.includes('auth/wrong-password') || msg.includes('auth/invalid-credential')) setError('Incorrect email or password.');
            else if (msg.includes('auth/user-not-found')) setError('No account found with this email.');
            else if (msg.includes('auth/weak-password')) setError('Password must be at least 6 characters.');
            else if (msg.includes('auth/invalid-email')) setError('Please enter a valid email address.');
            else setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loader}>Loading...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {/* Logo / Brand */}
                <div style={styles.brandSection}>
                    <div style={styles.logoIcon}>🧠</div>
                    <h1 style={styles.brandTitle}>NeuralTutor</h1>
                    <p style={styles.brandSubtitle}>AI-Powered Adaptive Learning</p>
                </div>

                {/* Tab Toggle */}
                <div style={styles.tabRow}>
                    <button
                        onClick={() => { setIsSignup(false); setError(''); }}
                        style={{
                            ...styles.tab,
                            ...(isSignup ? {} : styles.tabActive),
                        }}
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => { setIsSignup(true); setError(''); }}
                        style={{
                            ...styles.tab,
                            ...(isSignup ? styles.tabActive : {}),
                        }}
                    >
                        Sign Up
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={styles.form}>
                    {isSignup && (
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Full Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                placeholder="Your name"
                                style={styles.input}
                                required
                            />
                        </div>
                    )}
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            style={styles.input}
                            required
                        />
                    </div>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={styles.input}
                            required
                            minLength={6}
                        />
                    </div>

                    {error && <div style={styles.error}>{error}</div>}

                    <button type="submit" style={styles.submitBtn} disabled={submitting}>
                        {submitting
                            ? (isSignup ? 'Creating Account...' : 'Logging In...')
                            : (isSignup ? 'Create Account' : 'Log In')
                        }
                    </button>
                </form>

                <p style={styles.switchText}>
                    {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                    <button
                        onClick={() => { setIsSignup(!isSignup); setError(''); }}
                        style={styles.switchBtn}
                    >
                        {isSignup ? 'Log In' : 'Sign Up'}
                    </button>
                </p>
            </div>
        </div>
    );
}

// ---------- Inline Styles ----------
const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1f3c 50%, #0a0a1a 100%)',
        padding: '20px',
    },
    loader: {
        color: '#6ee7b7',
        fontSize: '18px',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(110, 231, 183, 0.15)',
        borderRadius: '20px',
        padding: '40px 32px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(110, 231, 183, 0.05)',
    },
    brandSection: {
        textAlign: 'center' as const,
        marginBottom: '28px',
    },
    logoIcon: {
        fontSize: '48px',
        marginBottom: '8px',
    },
    brandTitle: {
        fontSize: '28px',
        fontWeight: '800',
        background: 'linear-gradient(135deg, #6ee7b7, #3b82f6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        margin: '0 0 4px 0',
    },
    brandSubtitle: {
        fontSize: '13px',
        color: '#94a3b8',
        margin: 0,
    },
    tabRow: {
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        background: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '12px',
        padding: '4px',
    },
    tab: {
        flex: 1,
        padding: '10px',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        color: '#94a3b8',
        background: 'transparent',
        transition: 'all 0.2s',
    },
    tabActive: {
        background: 'rgba(110, 231, 183, 0.12)',
        color: '#6ee7b7',
    },
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '16px',
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '6px',
    },
    label: {
        fontSize: '13px',
        fontWeight: '500',
        color: '#94a3b8',
    },
    input: {
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid rgba(110, 231, 183, 0.15)',
        background: 'rgba(30, 41, 59, 0.6)',
        color: '#e2e8f0',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    error: {
        color: '#f87171',
        fontSize: '13px',
        padding: '10px 14px',
        background: 'rgba(248, 113, 113, 0.08)',
        borderRadius: '10px',
        border: '1px solid rgba(248, 113, 113, 0.2)',
    },
    submitBtn: {
        padding: '13px',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #059669, #10b981)',
        color: 'white',
        fontSize: '15px',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginTop: '4px',
    },
    switchText: {
        textAlign: 'center' as const,
        color: '#94a3b8',
        fontSize: '13px',
        marginTop: '20px',
    },
    switchBtn: {
        background: 'none',
        border: 'none',
        color: '#6ee7b7',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '13px',
    },
};
