// ============================================================
// Core Type Definitions for AI-Powered Educational Tutor
// ============================================================

/** Represents a single topic/concept in the knowledge graph */
export interface Topic {
    id: string;
    name: string;
    parentId?: string; // for subtopic hierarchy
    description: string;
    prerequisites: string[]; // IDs of prerequisite topics
}

/** Mastery state for a single topic */
export interface MasteryState {
    topicId: string;
    probability: number; // 0.0 to 1.0 mastery probability
    attempts: number;
    correctCount: number;
    lastAttemptAt: number; // timestamp
    streak: number; // consecutive correct
    history: ResponseRecord[];
}

/** A single student response record */
export interface ResponseRecord {
    questionId: string;
    topicId: string;
    isCorrect: boolean;
    difficulty: number; // 1-10
    responseTimeMs: number;
    timestamp: number;
}

/** Generated question */
export interface Question {
    id: string;
    topicId: string;
    difficulty: number; // 1-10
    type: 'multiple_choice' | 'true_false' | 'short_answer';
    questionText: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    hint?: string;
}

/** Student profile */
export interface StudentProfile {
    id: string;
    name: string;
    masteryStates: Record<string, MasteryState>; // keyed by topicId
    overallAbility: number; // 0-1 composite score
    learningRate: number; // how fast they learn (updates over time)
    totalSessions: number;
    totalTimeSpentMs: number;
}

/** Weak topic report */
export interface WeakTopicReport {
    topicId: string;
    topicName: string;
    mastery: number;
    failureRate: number;
    recentTrend: 'improving' | 'declining' | 'stagnant';
    suggestedDifficulty: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
}

/** Learning path step */
export interface LearningPathStep {
    topicId: string;
    topicName: string;
    estimatedQuestions: number;
    currentMastery: number;
    targetMastery: number;
    priority: number; // ordering weight
    reason: string;
}

/** Difficulty adjustment result */
export interface DifficultyResult {
    recommendedDifficulty: number;
    zone: 'comfort' | 'growth' | 'stretch';
    rationale: string;
}

/** Session state for an active learning session */
export interface SessionState {
    sessionId: string;
    studentId: string;
    startedAt: number;
    currentTopicId: string;
    questionsAnswered: number;
    correctInSession: number;
    currentDifficulty: number;
    currentQuestion: Question | null;
    sessionHistory: ResponseRecord[];
    isComplete: boolean;
}

/** Performance prediction */
export interface PerformancePrediction {
    topicId: string;
    currentMastery: number;
    predictedMastery30Days: number;
    predictedMastery90Days: number;
    confidence: number; // 0-1
    trajectorySlope: number;
}

/** Subject containing multiple topics */
export interface Subject {
    id: string;
    name: string;
    description: string;
    icon: string;
    topics: Topic[];
    color: string;
}
