// ============================================================
// Difficulty Calibrator
// ============================================================
// Maps student mastery levels to optimal question difficulty,
// implementing a "Zone of Proximal Development" approach.

import { MasteryState, DifficultyResult } from '../types';

/**
 * Calculates the recommended difficulty for the next question.
 *
 * Uses the Zone of Proximal Development (ZPD) concept:
 * - Comfort Zone:  Difficulty slightly below mastery (reinforcement)
 * - Growth Zone:   Difficulty at mastery level (optimal learning)
 * - Stretch Zone:  Difficulty slightly above mastery (challenge)
 *
 * The system primarily targets the Growth Zone, moving into
 * Stretch after consecutive correct answers and Comfort after errors.
 */
export function calibrateDifficulty(state: MasteryState): DifficultyResult {
    const mastery = state.probability;
    const streak = state.streak;

    // Base difficulty: linear map from mastery (0-1) to difficulty (1-10)
    let baseDifficulty = Math.round(mastery * 9 + 1);

    // Streak adjustment: push into stretch zone after consecutive correct
    let zone: DifficultyResult['zone'] = 'growth';
    let adjustment = 0;

    if (streak >= 5) {
        // Strong performance → stretch zone
        adjustment = 2;
        zone = 'stretch';
    } else if (streak >= 3) {
        adjustment = 1;
        zone = 'stretch';
    } else if (streak === 0 && state.attempts > 0) {
        // Last answer was wrong → comfort zone
        adjustment = -1;
        zone = 'comfort';
    }

    // Recency penalty: if last attempt was wrong, dial back further
    const recentHistory = state.history.slice(-3);
    const recentCorrectRate = recentHistory.length > 0
        ? recentHistory.filter(r => r.isCorrect).length / recentHistory.length
        : 0.5;

    if (recentCorrectRate < 0.33) {
        adjustment = -2;
        zone = 'comfort';
    }

    const recommendedDifficulty = Math.max(1, Math.min(10, baseDifficulty + adjustment));

    const rationale = generateRationale(mastery, recommendedDifficulty, zone, streak);

    return {
        recommendedDifficulty,
        zone,
        rationale,
    };
}

/**
 * Generates a human-readable rationale for the difficulty choice.
 */
function generateRationale(
    mastery: number,
    difficulty: number,
    zone: string,
    streak: number
): string {
    const masteryPct = Math.round(mastery * 100);

    if (zone === 'stretch') {
        return `Mastery at ${masteryPct}% with a streak of ${streak}. Increasing challenge to difficulty ${difficulty} to push into the stretch zone.`;
    } else if (zone === 'comfort') {
        return `Mastery at ${masteryPct}% with recent struggles. Reducing to difficulty ${difficulty} for reinforcement in the comfort zone.`;
    } else {
        return `Mastery at ${masteryPct}%. Targeting difficulty ${difficulty} in the optimal growth zone.`;
    }
}

/**
 * Given a target difficulty, returns difficulty-specific constraints
 * for question generation prompts.
 */
export function getDifficultyConstraints(difficulty: number): string {
    if (difficulty <= 2) {
        return 'Basic recall and recognition. Use simple vocabulary. Provide obvious answer choices. Focus on fundamental definitions.';
    } else if (difficulty <= 4) {
        return 'Basic understanding and application. Questions may require simple reasoning. Include some plausible distractors.';
    } else if (difficulty <= 6) {
        return 'Intermediate application and analysis. Require multi-step reasoning. Include nuanced distractors that test common misconceptions.';
    } else if (difficulty <= 8) {
        return 'Advanced analysis and evaluation. Require synthesis of multiple concepts. Include subtle distinctions between answer choices.';
    } else {
        return 'Expert-level synthesis and creation. Require deep conceptual understanding. Include highly plausible distractors that test edge cases and interdependencies.';
    }
}
