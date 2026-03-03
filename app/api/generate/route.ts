import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/generate
 * Proxy to Gemini (or OpenAI-compatible) API for question generation and feedback.
 * 
 * For demo purposes, this uses a built-in mock generator when no API key is configured.
 * Set GEMINI_API_KEY or OPENAI_API_KEY in .env.local to use real AI.
 */
export async function POST(request: NextRequest) {
    try {
        const { prompt, type } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

        if (apiKey && process.env.GEMINI_API_KEY) {
            // Use Gemini API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: type === 'question' ? 0.8 : 0.7,
                            maxOutputTokens: 1024,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini API error:', errorText);
                return NextResponse.json({ result: generateMockResponse(prompt, type) });
            }

            const data = await response.json();
            const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return NextResponse.json({ result });

        } else if (apiKey && process.env.OPENAI_API_KEY) {
            // Use OpenAI-compatible API
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: type === 'question' ? 0.8 : 0.7,
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) {
                return NextResponse.json({ result: generateMockResponse(prompt, type) });
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content || '';
            return NextResponse.json({ result });

        } else {
            // No API key — use mock generator
            return NextResponse.json({ result: generateMockResponse(prompt, type) });
        }

    } catch (error) {
        console.error('Generate API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Mock response generator for demo mode (no API key required).
 */
function generateMockResponse(prompt: string, type: string): string {
    if (type === 'feedback') {
        if (prompt.includes('correctly')) {
            return "Excellent work! You've demonstrated a solid understanding of this concept. Keep building on this momentum!";
        } else {
            return "Don't worry — this is a tricky concept. The key thing to remember is to break it down into smaller parts. Review the explanation above and try to connect it with what you already know. You're making great progress!";
        }
    }

    // Extract topic from prompt
    const topicMatch = prompt.match(/about "([^"]+)"/);
    const topic = topicMatch ? topicMatch[1] : 'this topic';

    // Extract difficulty
    const diffMatch = prompt.match(/Difficulty Level: (\d+)/);
    const diff = diffMatch ? parseInt(diffMatch[1]) : 5;

    // Generate varied questions based on topic keywords
    const questions = getTopicQuestions(topic, diff);
    const selected = questions[Math.floor(Math.random() * questions.length)];

    return JSON.stringify(selected);
}

function getTopicQuestions(topic: string, difficulty: number) {
    const topicLower = topic.toLowerCase();

    if (topicLower.includes('algebra')) {
        return [
            {
                questionText: "What is the value of x in the equation 2x + 6 = 14?",
                type: "multiple_choice",
                options: ["x = 4", "x = 5", "x = 3", "x = 10"],
                correctAnswer: "x = 4",
                explanation: "Subtract 6 from both sides: 2x = 8, then divide by 2: x = 4.",
                hint: "Try isolating x by performing inverse operations."
            },
            {
                questionText: "Which of the following is a variable expression?",
                type: "multiple_choice",
                options: ["3x + 7", "42", "3 + 7", "10 ÷ 2"],
                correctAnswer: "3x + 7",
                explanation: "A variable expression contains at least one variable (like x). '3x + 7' contains the variable x.",
                hint: "Look for a letter that represents an unknown value."
            },
            {
                questionText: "Simplify: 3(x + 4) - 2x",
                type: "multiple_choice",
                options: ["x + 12", "5x + 4", "x + 4", "3x + 12"],
                correctAnswer: "x + 12",
                explanation: "Distribute: 3x + 12 - 2x = x + 12.",
                hint: "First distribute the 3, then combine like terms."
            }
        ];
    }

    if (topicLower.includes('linear')) {
        return [
            {
                questionText: "What is the slope of the line y = 3x - 5?",
                type: "multiple_choice",
                options: ["3", "-5", "5", "-3"],
                correctAnswer: "3",
                explanation: "In y = mx + b form, the slope m is the coefficient of x, which is 3.",
                hint: "In slope-intercept form y = mx + b, which part is the slope?"
            },
            {
                questionText: "Which point lies on the line y = 2x + 1?",
                type: "multiple_choice",
                options: ["(2, 5)", "(1, 4)", "(3, 5)", "(0, 2)"],
                correctAnswer: "(2, 5)",
                explanation: "Substituting x = 2: y = 2(2) + 1 = 5. So (2, 5) lies on the line.",
                hint: "Substitute each x-value into the equation and check if y matches."
            }
        ];
    }

    if (topicLower.includes('quadratic')) {
        return [
            {
                questionText: "What are the solutions to x² - 5x + 6 = 0?",
                type: "multiple_choice",
                options: ["x = 2 and x = 3", "x = -2 and x = -3", "x = 1 and x = 6", "x = -1 and x = -6"],
                correctAnswer: "x = 2 and x = 3",
                explanation: "Factor: (x - 2)(x - 3) = 0, so x = 2 or x = 3.",
                hint: "Try to find two numbers that multiply to 6 and add to -5."
            }
        ];
    }

    if (topicLower.includes('newton') || topicLower.includes('motion')) {
        return [
            {
                questionText: "Newton's First Law states that an object at rest stays at rest unless acted upon by what?",
                type: "multiple_choice",
                options: ["An unbalanced force", "Gravity only", "Friction only", "Its own inertia"],
                correctAnswer: "An unbalanced force",
                explanation: "Newton's First Law (Law of Inertia) states that an object will remain in its state of motion unless acted upon by an unbalanced (net) force.",
                hint: "Think about what 'inertia' means and what can overcome it."
            },
            {
                questionText: "According to F = ma, if mass doubles and force stays the same, what happens to acceleration?",
                type: "multiple_choice",
                options: ["It halves", "It doubles", "It stays the same", "It quadruples"],
                correctAnswer: "It halves",
                explanation: "Since a = F/m, doubling mass while keeping force constant gives half the acceleration.",
                hint: "Rearrange the formula to solve for acceleration."
            }
        ];
    }

    if (topicLower.includes('cell')) {
        return [
            {
                questionText: "Which organelle is known as the 'powerhouse of the cell'?",
                type: "multiple_choice",
                options: ["Mitochondria", "Nucleus", "Ribosome", "Endoplasmic reticulum"],
                correctAnswer: "Mitochondria",
                explanation: "Mitochondria produce ATP through cellular respiration, providing energy for the cell.",
                hint: "Think about which organelle is responsible for energy production."
            }
        ];
    }

    if (topicLower.includes('variable') || topicLower.includes('data type')) {
        return [
            {
                questionText: "Which of the following is NOT a primitive data type in most programming languages?",
                type: "multiple_choice",
                options: ["Array", "Integer", "Boolean", "String"],
                correctAnswer: "Array",
                explanation: "Array is a data structure, not a primitive type. Primitive types include integer, boolean, float, char, and string.",
                hint: "Primitive types hold single values. Which one holds multiple values?"
            }
        ];
    }

    if (topicLower.includes('control flow') || topicLower.includes('loop')) {
        return [
            {
                questionText: "How many times will a 'for(i=0; i<5; i++)' loop execute its body?",
                type: "multiple_choice",
                options: ["5 times", "4 times", "6 times", "Infinite"],
                correctAnswer: "5 times",
                explanation: "i starts at 0 and runs while i < 5, so i takes values 0, 1, 2, 3, 4 — that's 5 iterations.",
                hint: "Count from the starting value up to (but not including) the limit."
            }
        ];
    }

    if (topicLower.includes('ancient') || topicLower.includes('civilization')) {
        return [
            {
                questionText: "Which ancient civilization is credited with inventing the first known writing system?",
                type: "multiple_choice",
                options: ["Sumerians (Mesopotamia)", "Ancient Egypt", "Ancient Greece", "Ancient China"],
                correctAnswer: "Sumerians (Mesopotamia)",
                explanation: "The Sumerians developed cuneiform around 3400 BCE, making it the earliest known writing system.",
                hint: "This civilization was located between the Tigris and Euphrates rivers."
            }
        ];
    }

    // Generic fallback
    return [
        {
            questionText: `Which statement best describes a core concept of ${topic}?`,
            type: "multiple_choice",
            options: [
                `It is a fundamental principle studied systematically`,
                `It has no practical applications`,
                `It was discovered in the 21st century`,
                `It only applies in theoretical contexts`
            ],
            correctAnswer: `It is a fundamental principle studied systematically`,
            explanation: `${topic} encompasses fundamental principles that are studied and applied systematically across various contexts.`,
            hint: "Think about the foundational nature of this subject."
        }
    ];
}
