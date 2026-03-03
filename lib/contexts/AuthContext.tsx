'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: 'user' | 'admin';
}

interface AuthContextType {
    user: AuthUser | null;
    firebaseUser: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, displayName: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                setFirebaseUser(fbUser);
                // Get user role from Firestore
                const userDoc = await getDoc(doc(firestore, 'users', fbUser.uid));
                const role = userDoc.exists() ? (userDoc.data().role || 'user') : 'user';
                setUser({
                    uid: fbUser.uid,
                    email: fbUser.email,
                    displayName: fbUser.displayName,
                    role,
                });
                // Update last active timestamp
                await setDoc(doc(firestore, 'users', fbUser.uid), {
                    lastActiveAt: serverTimestamp(),
                }, { merge: true });
            } else {
                setFirebaseUser(null);
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signup = async (email: string, password: string, displayName: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        // Create Firestore user document
        await setDoc(doc(firestore, 'users', cred.user.uid), {
            email,
            displayName,
            role: 'user',
            createdAt: serverTimestamp(),
            lastActiveAt: serverTimestamp(),
            totalSessions: 0,
            overallAbility: 0,
        });
        setUser({
            uid: cred.user.uid,
            email: cred.user.email,
            displayName,
            role: 'user',
        });
    };

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setFirebaseUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, firebaseUser, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
