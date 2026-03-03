'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';

interface UserRecord {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    totalSessions: number;
    overallAbility: number;
    lastActiveAt: number | null;
    createdAt: number | null;
}

interface PlatformStats {
    totalUsers: number;
    activeThisWeek: number;
    totalSessions: number;
    avgAbility: number;
}

export default function AdminPage() {
    const { user, loading: authLoading, login } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showLogin, setShowLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isAdmin = user?.role === 'admin';

    // Load admin data
    useEffect(() => {
        if (!user || !isAdmin) return;
        loadAdminData();
    }, [user, isAdmin]);

    const loadAdminData = async () => {
        setLoadingData(true);
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, orderBy('lastActiveAt', 'desc'));
            const snapshot = await getDocs(q);

            const userList: UserRecord[] = [];
            let totalSessions = 0;
            let totalAbility = 0;
            let activeThisWeek = 0;
            const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

            snapshot.forEach(doc => {
                const data = doc.data();
                const lastActive = data.lastActiveAt?.toMillis?.() || data.lastActiveAt || null;
                const created = data.createdAt?.toMillis?.() || data.createdAt || null;

                userList.push({
                    uid: doc.id,
                    email: data.email || '',
                    displayName: data.displayName || 'Unknown',
                    role: data.role || 'user',
                    totalSessions: data.totalSessions || 0,
                    overallAbility: data.overallAbility || 0,
                    lastActiveAt: lastActive,
                    createdAt: created,
                });

                totalSessions += data.totalSessions || 0;
                totalAbility += data.overallAbility || 0;
                if (lastActive && lastActive > oneWeekAgo) activeThisWeek++;
            });

            setUsers(userList);
            setStats({
                totalUsers: userList.length,
                activeThisWeek,
                totalSessions,
                avgAbility: userList.length > 0 ? totalAbility / userList.length : 0,
            });
        } catch (err) {
            console.error('Failed to load admin data:', err);
        } finally {
            setLoadingData(false);
        }
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setSubmitting(true);
        try {
            await login(email, password);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Login failed';
            if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
                setLoginError('Invalid email or password.');
            } else {
                setLoginError(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (ts: number | null) => {
        if (!ts) return 'Never';
        return new Date(ts).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const filteredUsers = users.filter(u =>
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Loading state
    if (authLoading) {
        return (
            <div style={s.pageContainer}>
                <div style={s.centerBox}>
                    <div style={s.loader}>Loading...</div>
                </div>
            </div>
        );
    }

    // Not logged in — show admin login form
    if (!user) {
        return (
            <div style={s.pageContainer}>
                <div style={s.loginCard}>
                    <div style={s.brandSection}>
                        <div style={s.logoIcon}>🛡️</div>
                        <h1 style={s.brandTitle}>Admin Panel</h1>
                        <p style={s.brandSubtitle}>NeuralTutor Administration</p>
                    </div>
                    <form onSubmit={handleAdminLogin} style={s.form}>
                        <div style={s.fieldGroup}>
                            <label style={s.label}>Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="admin@example.com" style={s.input} required />
                        </div>
                        <div style={s.fieldGroup}>
                            <label style={s.label}>Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••" style={s.input} required />
                        </div>
                        {loginError && <div style={s.error}>{loginError}</div>}
                        <button type="submit" style={s.submitBtn} disabled={submitting}>
                            {submitting ? 'Logging in...' : 'Admin Login'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Logged in but NOT admin
    if (!isAdmin) {
        return (
            <div style={s.pageContainer}>
                <div style={s.accessDenied}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Access Denied</h2>
                    <p style={{ color: '#94a3b8', marginBottom: 24 }}>You don&apos;t have admin privileges.</p>
                    <button onClick={() => router.push('/')} style={s.backBtn}>← Back to Tutor</button>
                </div>
            </div>
        );
    }

    // Admin dashboard
    return (
        <div style={s.pageContainer}>
            <div style={s.dashContainer}>
                {/* Header */}
                <div style={s.dashHeader}>
                    <div>
                        <h1 style={s.dashTitle}>🛡️ Admin Dashboard</h1>
                        <p style={s.dashSubtitle}>NeuralTutor Platform Administration</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>👤 {user.displayName || user.email}</span>
                        <button onClick={() => router.push('/')} style={s.backBtn}>← Tutor</button>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div style={s.statsGrid}>
                        <div style={s.statCard}>
                            <div style={s.statIcon}>👥</div>
                            <div style={s.statValue}>{stats.totalUsers}</div>
                            <div style={s.statLabel}>Total Users</div>
                        </div>
                        <div style={s.statCard}>
                            <div style={s.statIcon}>🟢</div>
                            <div style={s.statValue}>{stats.activeThisWeek}</div>
                            <div style={s.statLabel}>Active This Week</div>
                        </div>
                        <div style={s.statCard}>
                            <div style={s.statIcon}>📝</div>
                            <div style={s.statValue}>{stats.totalSessions}</div>
                            <div style={s.statLabel}>Total Sessions</div>
                        </div>
                        <div style={s.statCard}>
                            <div style={s.statIcon}>🎯</div>
                            <div style={s.statValue}>{Math.round(stats.avgAbility * 100)}%</div>
                            <div style={s.statLabel}>Avg Mastery</div>
                        </div>
                    </div>
                )}

                {/* Users Table */}
                <div style={s.tableSection}>
                    <div style={s.tableHeader}>
                        <h2 style={s.tableTitle}>All Users</h2>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={s.searchInput}
                        />
                    </div>

                    {loadingData ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading users...</div>
                    ) : (
                        <div style={s.tableWrapper}>
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        <th style={s.th}>Name</th>
                                        <th style={s.th}>Email</th>
                                        <th style={s.th}>Role</th>
                                        <th style={s.th}>Sessions</th>
                                        <th style={s.th}>Mastery</th>
                                        <th style={s.th}>Last Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => (
                                        <tr key={u.uid} style={s.tr}>
                                            <td style={s.td}>
                                                <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                                            </td>
                                            <td style={{ ...s.td, color: '#94a3b8' }}>{u.email}</td>
                                            <td style={s.td}>
                                                <span style={{
                                                    ...s.roleBadge,
                                                    ...(u.role === 'admin' ? s.roleBadgeAdmin : {}),
                                                }}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td style={s.td}>{u.totalSessions}</td>
                                            <td style={s.td}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={s.miniBar}>
                                                        <div style={{
                                                            ...s.miniBarFill,
                                                            width: `${Math.round(u.overallAbility * 100)}%`,
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                                        {Math.round(u.overallAbility * 100)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ ...s.td, color: '#94a3b8', fontSize: 12 }}>
                                                {formatDate(u.lastActiveAt)}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#64748b' }}>
                                                No users found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------- Inline Styles ----------
const s: Record<string, React.CSSProperties> = {
    pageContainer: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1f3c 50%, #0a0a1a 100%)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 24,
    },
    centerBox: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
    },
    loader: { color: '#6ee7b7', fontSize: 18 },
    loginCard: {
        width: '100%',
        maxWidth: 420,
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(234, 179, 8, 0.2)',
        borderRadius: 20,
        padding: '40px 32px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(234,179,8,0.05)',
        marginTop: '15vh',
    },
    brandSection: { textAlign: 'center' as const, marginBottom: 28 },
    logoIcon: { fontSize: 48, marginBottom: 8 },
    brandTitle: {
        fontSize: 28, fontWeight: 800,
        background: 'linear-gradient(135deg, #eab308, #f59e0b)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        margin: '0 0 4px 0',
    },
    brandSubtitle: { fontSize: 13, color: '#94a3b8', margin: 0 },
    form: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
    fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    label: { fontSize: 13, fontWeight: 500, color: '#94a3b8' },
    input: {
        padding: '12px 14px', borderRadius: 10,
        border: '1px solid rgba(234, 179, 8, 0.15)',
        background: 'rgba(30, 41, 59, 0.6)',
        color: '#e2e8f0', fontSize: 14, outline: 'none',
    },
    error: {
        color: '#f87171', fontSize: 13, padding: '10px 14px',
        background: 'rgba(248,113,113,0.08)', borderRadius: 10,
        border: '1px solid rgba(248,113,113,0.2)',
    },
    submitBtn: {
        padding: 13, borderRadius: 12, border: 'none',
        background: 'linear-gradient(135deg, #ca8a04, #eab308)',
        color: 'white', fontSize: 15, fontWeight: 700,
        cursor: 'pointer', marginTop: 4,
    },
    accessDenied: {
        textAlign: 'center' as const, marginTop: '20vh',
        background: 'rgba(15,23,42,0.85)', padding: 48, borderRadius: 20,
        border: '1px solid rgba(239,68,68,0.2)',
    },
    backBtn: {
        padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    dashContainer: { width: '100%', maxWidth: 1200 },
    dashHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexWrap: 'wrap' as const, gap: 16,
    },
    dashTitle: {
        fontSize: 28, fontWeight: 800,
        background: 'linear-gradient(135deg, #eab308, #f59e0b)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    dashSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
    statsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16, marginBottom: 32,
    },
    statCard: {
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 24, textAlign: 'center' as const,
    },
    statIcon: { fontSize: 28, marginBottom: 8 },
    statValue: { fontSize: 36, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 },
    statLabel: { fontSize: 13, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1 },
    tableSection: {
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 24, overflow: 'hidden',
    },
    tableHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, flexWrap: 'wrap' as const, gap: 12,
    },
    tableTitle: { fontSize: 20, fontWeight: 700 },
    searchInput: {
        padding: '10px 16px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(30,41,59,0.6)', color: '#e2e8f0',
        fontSize: 13, outline: 'none', width: 260,
    },
    tableWrapper: { overflowX: 'auto' as const },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    th: {
        textAlign: 'left' as const, padding: '12px 16px',
        fontSize: 11, fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase' as const, letterSpacing: 1,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
    td: { padding: '14px 16px', fontSize: 14, color: '#e2e8f0' },
    roleBadge: {
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: 'rgba(99,102,241,0.1)', color: '#818cf8',
        textTransform: 'uppercase' as const,
    },
    roleBadgeAdmin: {
        background: 'rgba(234,179,8,0.15)', color: '#eab308',
    },
    miniBar: {
        width: 60, height: 6, background: 'rgba(255,255,255,0.06)',
        borderRadius: 3, overflow: 'hidden',
    },
    miniBarFill: {
        height: '100%', borderRadius: 3,
        background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
    },
};
