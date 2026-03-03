// ============================================================
// AI Question Generator
// ============================================================
// Uses LLM (Gemini/OpenAI-compatible) to generate contextually
// relevant quiz questions targeting specific topics and difficulties.

import { Question, Topic, DifficultyResult } from '../types';
import { getDifficultyConstraints } from '../engine/difficultyCalibrator';

/**
 * Generates a quiz question using an AI model via the /api/generate route.
 */
export async function generateQuestion(
    topic: Topic,
    difficulty: DifficultyResult,
    previousQuestions: string[] = [],
    studentContext?: string
): Promise<Question> {
    const difficultyConstraints = getDifficultyConstraints(difficulty.recommendedDifficulty);

    const prompt = buildPrompt(topic, difficulty, difficultyConstraints, previousQuestions, studentContext);

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, type: 'question' }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return parseQuestionResponse(data.result, topic.id, difficulty.recommendedDifficulty);
    } catch (error) {
        console.error('Question generation failed, using fallback:', error);
        return generateFallbackQuestion(topic, difficulty.recommendedDifficulty);
    }
}

/**
 * Generates contextual feedback for an answered question.
 */
export async function generateFeedback(
    question: Question,
    studentAnswer: string,
    isCorrect: boolean
): Promise<string> {
    const prompt = `You are an encouraging educational tutor. A student just ${isCorrect ? 'correctly' : 'incorrectly'} answered a question.

Question: ${question.questionText}
Student's Answer: ${studentAnswer}
Correct Answer: ${question.correctAnswer}
Explanation: ${question.explanation}

${isCorrect
            ? 'Provide a brief, enthusiastic congratulatory response (2-3 sentences). Reinforce WHY the answer is correct with a key insight.'
            : 'Provide a supportive, non-judgmental explanation (3-4 sentences). Explain the correct answer clearly and give a helpful tip for remembering this concept. Do NOT be condescending.'
        }

Respond in plain text, no markdown.`;

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, type: 'feedback' }),
        });

        if (!response.ok) throw new Error('Feedback generation failed');

        const data = await response.json();
        return data.result;
    } catch {
        return isCorrect
            ? `Correct! ${question.explanation}`
            : `Not quite. The correct answer is "${question.correctAnswer}". ${question.explanation}`;
    }
}

/**
 * Builds the question generation prompt.
 */
function buildPrompt(
    topic: Topic,
    difficulty: DifficultyResult,
    constraints: string,
    previousQuestions: string[],
    studentContext?: string
): string {
    const avoidList = previousQuestions.length > 0
        ? `\n\nIMPORTANT: Do NOT repeat or closely paraphrase these previously asked questions:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
        : '';

    const contextInfo = studentContext
        ? `\n\nStudent Context: ${studentContext}`
        : '';

    return `You are an expert educational content creator. Generate a single quiz question about "${topic.name}" (${topic.description}).

Difficulty Level: ${difficulty.recommendedDifficulty}/10 (${difficulty.zone} zone)
Difficulty Guidelines: ${constraints}
${contextInfo}${avoidList}

You MUST respond in valid JSON with exactly this structure:
{
  "questionText": "The question text",
  "type": "multiple_choice",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "The correct option exactly as written in options",
  "explanation": "Clear explanation of why this is correct",
  "hint": "A subtle hint without giving away the answer"
}

Rules:
- Question must be factually accurate
- All 4 options must be plausible
- Explanation should be educational and concise
- The correct answer must exactly match one of the options`;
}

/**
 * Parses the LLM response into a Question object.
 */
function parseQuestionResponse(response: string, topicId: string, difficulty: number): Question {
    try {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            topicId,
            difficulty,
            type: parsed.type || 'multiple_choice',
            questionText: parsed.questionText,
            options: parsed.options,
            correctAnswer: parsed.correctAnswer,
            explanation: parsed.explanation,
            hint: parsed.hint,
        };
    } catch (error) {
        console.error('Failed to parse question response:', error);
        throw new Error('Invalid question format from AI');
    }
}

/**
 * Generates a fallback question when AI is unavailable.
 */
function generateFallbackQuestion(topic: Topic, difficulty: number): Question {
    return {
        id: `fallback_${Date.now()}`,
        topicId: topic.id,
        difficulty,
        type: 'multiple_choice',
        questionText: `Which of the following best describes "${topic.name}"?`,
        options: [
            topic.description,
            `A concept unrelated to ${topic.name}`,
            `The opposite of ${topic.name}`,
            `A prerequisite for advanced ${topic.name}`,
        ],
        correctAnswer: topic.description,
        explanation: `"${topic.name}" is described as: ${topic.description}`,
        hint: 'Think about the core definition of this concept.',
    };
}
