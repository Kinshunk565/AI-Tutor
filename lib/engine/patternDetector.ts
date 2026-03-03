// ============================================================
// Pattern Detector & Weak Topic Analyzer
// ============================================================
// Analyzes historical performance to identify knowledge gaps,
// weak clusters, and performance trends.

import { StudentProfile, WeakTopicReport, LearningPathStep, MasteryState, Topic } from '../types';
import { computeOverallAbility, computeLearningRate } from './knowledgeTracing';

/**
 * Identifies weak topics where the student underperforms
 * relative to their overall ability.
 */
export function detectWeakTopics(
    profile: StudentProfile,
    topics: Topic[]
): WeakTopicReport[] {
    const overallAbility = computeOverallAbility(profile);
    const reports: WeakTopicReport[] = [];

    for (const topic of topics) {
        const state = profile.masteryStates[topic.id];
        if (!state || state.attempts < 2) continue; // need data

        const failureRate = state.attempts > 0
            ? 1 - (state.correctCount / state.attempts)
            : 0;

        // Calculate relative weakness: how far below overall ability
        const relativeWeakness = overallAbility - state.probability;

        // Determine trend from recent performance
        const recentTrend = detectTrend(state);

        // Assign priority based on weakness magnitude and failure rate
        let priority: WeakTopicReport['priority'];
        if (relativeWeakness > 0.3 || (failureRate > 0.7 && state.attempts >= 5)) {
            priority = 'critical';
        } else if (relativeWeakness > 0.2 || failureRate > 0.5) {
            priority = 'high';
        } else if (relativeWeakness > 0.1 || failureRate > 0.35) {
            priority = 'medium';
        } else {
            priority = 'low';
        }

        // Only report topics that are genuinely weak (below average or high failure)
        if (relativeWeakness > 0.05 || failureRate > 0.4) {
            reports.push({
                topicId: topic.id,
                topicName: topic.name,
                mastery: state.probability,
                failureRate,
                recentTrend,
                suggestedDifficulty: Math.max(1, Math.round(state.probability * 7 + 1)),
                priority,
            });
        }
    }

    // Sort by priority (critical first)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return reports.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Detects performance trend from recent history.
 */
function detectTrend(state: MasteryState): 'improving' | 'declining' | 'stagnant' {
    if (state.history.length < 4) return 'stagnant';

    const recent = state.history.slice(-6);
    const half = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, half);
    const secondHalf = recent.slice(half);

    const firstRate = firstHalf.filter(r => r.isCorrect).length / firstHalf.length;
    const secondRate = secondHalf.filter(r => r.isCorrect).length / secondHalf.length;

    const diff = secondRate - firstRate;

    if (diff > 0.15) return 'improving';
    if (diff < -0.15) return 'declining';
    return 'stagnant';
}

/**
 * Generates a personalized learning path that sequences content 
 * strategically, prioritizing weak topics while reinforcing strengths.
 */
export function generateLearningPath(
    profile: StudentProfile,
    topics: Topic[],
    maxSteps: number = 10
): LearningPathStep[] {
    const weakReports = detectWeakTopics(profile, topics);
    const steps: LearningPathStep[] = [];
    const visited = new Set<string>();

    // Phase 1: Address critical and high-priority weak topics first
    for (const report of weakReports) {
        if (visited.size >= maxSteps) break;
        if (report.priority === 'critical' || report.priority === 'high') {
            // Check prerequisites first
            const topic = topics.find(t => t.id === report.topicId);
            if (topic) {
                // Add unmastered prerequisites
                for (const prereqId of topic.prerequisites) {
                    if (visited.has(prereqId)) continue;
                    const prereqState = profile.masteryStates[prereqId];
                    const prereqTopic = topics.find(t => t.id === prereqId);
                    if (prereqState && prereqState.probability < 0.5 && prereqTopic) {
                        steps.push({
                            topicId: prereqId,
                            topicName: prereqTopic.name,
                            estimatedQuestions: estimateQuestionsNeeded(prereqState),
                            currentMastery: prereqState.probability,
                            targetMastery: 0.7,
                            priority: steps.length,
                            reason: `Prerequisite for "${topic.name}" — needs strengthening before progressing.`,
                        });
                        visited.add(prereqId);
                    }
                }
            }

            if (!visited.has(report.topicId)) {
                const state = profile.masteryStates[report.topicId];
                steps.push({
                    topicId: report.topicId,
                    topicName: report.topicName,
                    estimatedQuestions: estimateQuestionsNeeded(state),
                    currentMastery: report.mastery,
                    targetMastery: 0.75,
                    priority: steps.length,
                    reason: `${report.priority === 'critical' ? '🔴' : '🟠'} ${report.priority.toUpperCase()} weakness — ${Math.round(report.failureRate * 100)}% failure rate, trending ${report.recentTrend}.`,
                });
                visited.add(report.topicId);
            }
        }
    }

    // Phase 2: Add medium-priority weak topics
    for (const report of weakReports) {
        if (visited.size >= maxSteps) break;
        if (report.priority === 'medium' && !visited.has(report.topicId)) {
            const state = profile.masteryStates[report.topicId];
            steps.push({
                topicId: report.topicId,
                topicName: report.topicName,
                estimatedQuestions: estimateQuestionsNeeded(state),
                currentMastery: report.mastery,
                targetMastery: 0.7,
                priority: steps.length,
                reason: `🟡 MEDIUM weakness — mastery at ${Math.round(report.mastery * 100)}%.`,
            });
            visited.add(report.topicId);
        }
    }

    // Phase 3: Reinforce near-mastered topics for spaced repetition
    for (const topic of topics) {
        if (visited.size >= maxSteps) break;
        const state = profile.masteryStates[topic.id];
        if (state && !visited.has(topic.id) && state.probability >= 0.6 && state.probability < 0.85) {
            steps.push({
                topicId: topic.id,
                topicName: topic.name,
                estimatedQuestions: 3,
                currentMastery: state.probability,
                targetMastery: 0.9,
                priority: steps.length,
                reason: '🟢 Reinforcement — solidify near-mastered knowledge.',
            });
            visited.add(topic.id);
        }
    }

    return steps;
}

/**
 * Estimates how many questions are needed to reach target mastery.
 */
function estimateQuestionsNeeded(state: MasteryState, targetMastery: number = 0.75): number {
    const gap = targetMastery - state.probability;
    if (gap <= 0) return 2; // maintenance

    // Rough heuristic: each question can move mastery ~5-15%
    const avgGainPerQuestion = 0.08;
    const estimated = Math.ceil(gap / avgGainPerQuestion);
    return Math.max(3, Math.min(20, estimated));
}

/**
 * Computes a reinforcement learning reward signal based on
 * improvement in student mastery after a session.
 */
export function computeReward(
    preSessionMastery: Record<string, number>,
    postSessionMastery: Record<string, number>,
    weakTopicIds: string[]
): number {
    let reward = 0;

    for (const topicId of Object.keys(postSessionMastery)) {
        const pre = preSessionMastery[topicId] ?? 0;
        const post = postSessionMastery[topicId] ?? 0;
        const improvement = post - pre;

        // Higher reward for improving weak topics
        const multiplier = weakTopicIds.includes(topicId) ? 2.0 : 1.0;
        reward += improvement * multiplier;
    }

    // Penalize no-improvement or regression
    if (reward <= 0) {
        reward = -0.1;
    }

    return reward;
}
