// ============================================================
// Bayesian Knowledge Tracing (BKT) Engine
// ============================================================
// Implements a modified BKT model with Elo-style adjustments
// to estimate student mastery probability per topic.

import { MasteryState, ResponseRecord, StudentProfile, PerformancePrediction } from '../types';

/** BKT Parameters (tunable per topic) */
interface BKTParams {
    pInit: number;    // P(L₀) - initial probability of knowing
    pTransit: number; // P(T)  - probability of learning from not-known
    pSlip: number;    // P(S)  - probability of incorrect despite knowing
    pGuess: number;   // P(G)  - probability of correct despite not knowing
}

/** Default BKT parameters */
const DEFAULT_BKT: BKTParams = {
    pInit: 0.1,
    pTransit: 0.15,
    pSlip: 0.1,
    pGuess: 0.25,
};

/**
 * Updates mastery probability using Bayesian Knowledge Tracing.
 *
 * After observing a correct or incorrect response:
 *   If correct:
 *     P(L|correct) = P(L) * (1 - P(S)) / [P(L)*(1-P(S)) + (1-P(L))*P(G)]
 *   If incorrect:
 *     P(L|incorrect) = P(L) * P(S) / [P(L)*P(S) + (1-P(L))*(1-P(G))]
 *   Then apply transition:
 *     P(Lₙ) = P(L|obs) + (1 - P(L|obs)) * P(T)
 */
export function updateMastery(
    currentMastery: number,
    isCorrect: boolean,
    params: BKTParams = DEFAULT_BKT
): number {
    const { pSlip, pGuess, pTransit } = params;
    const pL = currentMastery;

    let pLGivenObs: number;

    if (isCorrect) {
        const numerator = pL * (1 - pSlip);
        const denominator = pL * (1 - pSlip) + (1 - pL) * pGuess;
        pLGivenObs = denominator > 0 ? numerator / denominator : pL;
    } else {
        const numerator = pL * pSlip;
        const denominator = pL * pSlip + (1 - pL) * (1 - pGuess);
        pLGivenObs = denominator > 0 ? numerator / denominator : pL;
    }

    // Apply learning transition
    const updatedMastery = pLGivenObs + (1 - pLGivenObs) * pTransit;

    return Math.max(0, Math.min(1, updatedMastery));
}

/**
 * Creates a fresh mastery state for a new topic.
 */
export function createInitialMastery(topicId: string): MasteryState {
    return {
        topicId,
        probability: DEFAULT_BKT.pInit,
        attempts: 0,
        correctCount: 0,
        lastAttemptAt: Date.now(),
        streak: 0,
        history: [],
    };
}

/**
 * Processes a student response and returns the updated MasteryState.
 */
export function processResponse(
    state: MasteryState,
    response: ResponseRecord
): MasteryState {
    // Adjust BKT params based on difficulty
    // Harder questions → lower guess probability, higher slip probability
    const difficultyFactor = response.difficulty / 10;
    const adjustedParams: BKTParams = {
        ...DEFAULT_BKT,
        pGuess: DEFAULT_BKT.pGuess * (1 - difficultyFactor * 0.5),
        pSlip: DEFAULT_BKT.pSlip * (1 + difficultyFactor * 0.3),
        // Boost learning rate for correct answers on hard questions
        pTransit: DEFAULT_BKT.pTransit * (1 + (response.isCorrect ? difficultyFactor * 0.4 : 0)),
    };

    const newProbability = updateMastery(state.probability, response.isCorrect, adjustedParams);

    // Apply time-decay bonus: if it's been a while, slightly reduce mastery
    const hoursSinceLastAttempt = (response.timestamp - state.lastAttemptAt) / (1000 * 60 * 60);
    const timeDecay = hoursSinceLastAttempt > 24 ? Math.max(0, 1 - 0.005 * hoursSinceLastAttempt) : 1;

    return {
        ...state,
        topicId: state.topicId,
        probability: Math.max(0, Math.min(1, newProbability * timeDecay)),
        attempts: state.attempts + 1,
        correctCount: state.correctCount + (response.isCorrect ? 1 : 0),
        lastAttemptAt: response.timestamp,
        streak: response.isCorrect ? state.streak + 1 : 0,
        history: [...state.history, response],
    };
}

/**
 * Computes overall student ability as a weighted average of all mastery states.
 */
export function computeOverallAbility(profile: StudentProfile): number {
    const states = Object.values(profile.masteryStates);
    if (states.length === 0) return 0;

    // Weighted by number of attempts (more data → more weight)
    let weightedSum = 0;
    let totalWeight = 0;

    for (const state of states) {
        const weight = Math.log2(state.attempts + 1) + 1; // log-weighted
        weightedSum += state.probability * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Computes learning rate: how quickly mastery improves per attempt.
 */
export function computeLearningRate(state: MasteryState): number {
    if (state.history.length < 2) return 0;

    // Look at last 10 attempts and compute slope
    const recentHistory = state.history.slice(-10);
    let masteryValues: number[] = [];
    let tempMastery = DEFAULT_BKT.pInit;

    for (const record of recentHistory) {
        tempMastery = updateMastery(tempMastery, record.isCorrect);
        masteryValues.push(tempMastery);
    }

    // Simple linear regression slope
    const n = masteryValues.length;
    const xMean = (n - 1) / 2;
    const yMean = masteryValues.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (masteryValues[i] - yMean);
        denominator += (i - xMean) * (i - xMean);
    }

    return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Predicts future mastery based on current trajectory.
 */
export function predictPerformance(
    state: MasteryState,
    attemptsPerDay: number = 5
): PerformancePrediction {
    const learningRate = computeLearningRate(state);

    // Extrapolate with diminishing returns (logarithmic growth)
    const predict = (days: number): number => {
        const futureAttempts = days * attemptsPerDay;
        const growth = learningRate * Math.log2(futureAttempts + 1) * 0.3;
        return Math.max(0, Math.min(1, state.probability + growth));
    };

    return {
        topicId: state.topicId,
        currentMastery: state.probability,
        predictedMastery30Days: predict(30),
        predictedMastery90Days: predict(90),
        confidence: Math.min(1, state.attempts / 20), // higher with more data
        trajectorySlope: learningRate,
    };
}
