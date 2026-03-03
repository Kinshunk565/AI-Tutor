// ============================================================
// Database Layer — localStorage + Firestore sync
// ============================================================
// Uses localStorage as a fast cache and Firestore as the
// persistent source of truth for logged-in users.

import { StudentProfile, SessionState, MasteryState } from './types';
import { createInitialMastery } from './engine/knowledgeTracing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';

const STORAGE_KEY = 'ai_tutor_profile';
const SESSION_KEY = 'ai_tutor_session';

/**
 * Creates a fresh default student profile with mastery for given topic IDs.
 */
export function createDefaultProfile(topicIds: string[]): StudentProfile {
    const masteryStates: Record<string, MasteryState> = {};

    for (const topicId of topicIds) {
        masteryStates[topicId] = createInitialMastery(topicId);
    }

    return {
        id: `student_${Date.now()}`,
        name: 'Student',
        masteryStates,
        overallAbility: 0,
        learningRate: 0,
        totalSessions: 0,
        totalTimeSpentMs: 0,
    };
}

/**
 * Gets or creates the student profile from localStorage.
 */
export function getProfile(topicIds: string[]): StudentProfile {
    if (typeof window === 'undefined') return createDefaultProfile(topicIds);

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const profile: StudentProfile = JSON.parse(stored);
            // Ensure all topics are initialized (handles new topics added later)
            let changed = false;
            for (const topicId of topicIds) {
                if (!profile.masteryStates[topicId]) {
                    profile.masteryStates[topicId] = createInitialMastery(topicId);
                    changed = true;
                }
            }
            if (changed) saveProfile(profile);
            return profile;
        } catch {
            const profile = createDefaultProfile(topicIds);
            saveProfile(profile);
            return profile;
        }
    }

    const profile = createDefaultProfile(topicIds);
    saveProfile(profile);
    return profile;
}

/**
 * Saves the student profile to localStorage.
 */
export function saveProfile(profile: StudentProfile): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Gets the current session state.
 */
export function getSession(): SessionState | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Saves the current session state.
 */
export function saveSession(session: SessionState): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Clears the current session.
 */
export function clearSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
}

/**
 * Resets all student data.
 */
export function resetAllData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
}

// ============================================================
// Firestore Sync Functions
// ============================================================

/**
 * Saves a student profile to Firestore (for a logged-in user).
 */
export async function syncProfileToFirestore(uid: string, profile: StudentProfile): Promise<void> {
    try {
        await setDoc(doc(firestore, 'users', uid, 'data', 'profile'), {
            ...profile,
            updatedAt: Date.now(),
        });
        // Also update the users summary doc for admin dashboard queries
        await setDoc(doc(firestore, 'users', uid), {
            displayName: profile.name,
            overallAbility: profile.overallAbility,
            totalSessions: profile.totalSessions,
            totalTimeSpentMs: profile.totalTimeSpentMs,
            lastActiveAt: Date.now(),
        }, { merge: true });
    } catch (err) {
        console.error('Failed to sync profile to Firestore:', err);
    }
}

/**
 * Loads a student profile from Firestore.
 * Returns null if no profile is stored.
 */
export async function loadProfileFromFirestore(uid: string): Promise<StudentProfile | null> {
    try {
        const snap = await getDoc(doc(firestore, 'users', uid, 'data', 'profile'));
        if (snap.exists()) {
            return snap.data() as StudentProfile;
        }
        return null;
    } catch (err) {
        console.error('Failed to load profile from Firestore:', err);
        return null;
    }
}
