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

    // Extract previously asked questions from the prompt to avoid repeats
    const previousQuestions: string[] = [];
    const avoidSection = prompt.match(/Do NOT repeat or closely paraphrase these previously asked questions:\n([\s\S]*?)(?:\n\n|$)/);
    if (avoidSection) {
        const lines = avoidSection[1].split('\n');
        for (const line of lines) {
            const qMatch = line.match(/^\d+\.\s+(.+)/);
            if (qMatch) {
                previousQuestions.push(qMatch[1].trim().toLowerCase());
            }
        }
    }

    // Generate varied questions based on topic keywords
    const questions = getTopicQuestions(topic, diff);

    // Filter out previously asked questions
    let available = questions.filter(q => {
        const qText = q.questionText.toLowerCase();
        return !previousQuestions.some(prev =>
            qText === prev || prev.includes(qText) || qText.includes(prev)
        );
    });

    // If all questions exhausted, fall back to full pool
    if (available.length === 0) {
        available = questions;
    }

    const selected = available[Math.floor(Math.random() * available.length)];

    // Shuffle the options so the correct answer isn't always first
    const shuffledOptions = [...selected.options];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }
    selected.options = shuffledOptions;

    return JSON.stringify(selected);
}

function getTopicQuestions(topic: string, difficulty: number) {
    const topicLower = topic.toLowerCase();
    const Q = (questionText: string, options: string[], correctAnswer: string, explanation: string, hint: string) =>
        ({ questionText, type: "multiple_choice", options, correctAnswer, explanation, hint });

    // --- MATHEMATICS ---
    if (topicLower.includes('algebra')) return [
        Q("What is the value of x in 2x + 6 = 14?", ["x = 4", "x = 5", "x = 3", "x = 10"], "x = 4", "2x = 8, so x = 4.", "Isolate x using inverse operations."),
        Q("Simplify: 3(x + 4) - 2x", ["x + 12", "5x + 4", "x + 4", "3x + 12"], "x + 12", "3x + 12 - 2x = x + 12.", "Distribute first, then combine like terms."),
        Q("Which is a variable expression?", ["3x + 7", "42", "3 + 7", "10 ÷ 2"], "3x + 7", "It contains the variable x.", "Look for a letter representing an unknown."),
        Q("If 5y - 3 = 17, what is y?", ["y = 4", "y = 3", "y = 5", "y = 2"], "y = 4", "5y = 20, y = 4.", "Add 3 to both sides first."),
        Q("What is the coefficient of x in 7x + 3?", ["7", "3", "x", "10"], "7", "The coefficient is the number multiplied by the variable.", "It's the number directly in front of x."),
        Q("Evaluate: 2³ + 4²", ["24", "20", "12", "16"], "24", "2³ = 8 and 4² = 16, so 8 + 16 = 24.", "Calculate each power separately, then add."),
        Q("Solve: 3x - 7 = 2x + 5", ["x = 12", "x = 7", "x = 5", "x = -2"], "x = 12", "Subtract 2x from both sides: x - 7 = 5, so x = 12.", "Get all x terms on one side."),
        Q("What is the value of 4(2x - 1) when x = 3?", ["20", "24", "16", "12"], "20", "4(2·3 - 1) = 4(6 - 1) = 4·5 = 20.", "Substitute first, then simplify."),
        Q("Simplify: (x² · x³)", ["x⁵", "x⁶", "x⁸", "2x⁵"], "x⁵", "When multiplying like bases, add exponents: 2 + 3 = 5.", "Remember the product rule for exponents."),
        Q("Which property states a(b + c) = ab + ac?", ["Distributive property", "Associative property", "Commutative property", "Identity property"], "Distributive property", "Distribution multiplies a across (b + c).", "Think about distributing across parentheses."),
        Q("Solve for x: x/4 = 9", ["x = 36", "x = 13", "x = 5", "x = 2.25"], "x = 36", "Multiply both sides by 4: x = 36.", "Undo division with multiplication."),
        Q("What is (-3)² equal to?", ["9", "-9", "6", "-6"], "9", "A negative times a negative is positive: (-3)·(-3) = 9.", "Squaring any number (positive or negative) gives a positive result."),
    ];

    if (topicLower.includes('linear')) return [
        Q("What is the slope of y = 3x - 5?", ["3", "-5", "5", "-3"], "3", "In y = mx + b, the slope m = 3.", "Which coefficient is attached to x?"),
        Q("Which point lies on y = 2x + 1?", ["(2, 5)", "(1, 4)", "(3, 5)", "(0, 2)"], "(2, 5)", "y = 2(2) + 1 = 5.", "Substitute each x-value and check."),
        Q("What is the y-intercept of y = -4x + 7?", ["7", "-4", "4", "-7"], "7", "The y-intercept is b in y = mx + b, which is 7.", "The y-intercept occurs when x = 0."),
        Q("Two lines with the same slope are:", ["Parallel", "Perpendicular", "Intersecting", "Identical"], "Parallel", "Parallel lines have equal slopes but different y-intercepts.", "Think about lines that never cross."),
        Q("If a line passes through (0,0) and (2,6), what is its slope?", ["3", "2", "6", "1/3"], "3", "Slope = (6-0)/(2-0) = 3.", "Use rise over run: (y₂-y₁)/(x₂-x₁)."),
        Q("What is the slope of a horizontal line?", ["0", "1", "Undefined", "Infinity"], "0", "Horizontal lines have no rise, so slope = 0.", "How much does the line go up or down?"),
        Q("The slope of a vertical line is:", ["Undefined", "0", "1", "Infinity"], "Undefined", "Vertical lines have no run, so division by zero makes slope undefined.", "What happens when you divide by zero?"),
        Q("Write the equation of a line with slope 2 and y-intercept -3:", ["y = 2x - 3", "y = -3x + 2", "y = 2x + 3", "y = -2x - 3"], "y = 2x - 3", "Using y = mx + b with m = 2 and b = -3.", "Plug the slope and y-intercept into y = mx + b."),
        Q("If y = 5x + 2, what is y when x = -1?", ["-3", "7", "3", "-7"], "-3", "y = 5(-1) + 2 = -5 + 2 = -3.", "Substitute -1 for x."),
        Q("Perpendicular lines have slopes that are:", ["Negative reciprocals", "Equal", "Both zero", "Both positive"], "Negative reciprocals", "If one slope is m, the perpendicular slope is -1/m.", "Flip the fraction and change the sign."),
    ];

    if (topicLower.includes('quadratic')) return [
        Q("What are the solutions to x² - 5x + 6 = 0?", ["x = 2 and x = 3", "x = -2 and x = -3", "x = 1 and x = 6", "x = -1 and x = -6"], "x = 2 and x = 3", "Factor: (x-2)(x-3) = 0.", "Find two numbers that multiply to 6 and add to -5."),
        Q("What is the vertex form of a quadratic?", ["y = a(x-h)² + k", "y = ax² + bx + c", "y = mx + b", "y = a/x"], "y = a(x-h)² + k", "Vertex form shows the vertex at (h, k).", "Which form explicitly shows the vertex coordinates?"),
        Q("The discriminant b²-4ac determines:", ["Number of real solutions", "The vertex", "The y-intercept", "The axis of symmetry"], "Number of real solutions", "If > 0: 2 solutions, = 0: 1 solution, < 0: no real solutions.", "It's the part under the square root in the quadratic formula."),
        Q("What shape does a quadratic equation graph?", ["Parabola", "Straight line", "Circle", "Hyperbola"], "Parabola", "All quadratic functions produce a U-shaped parabola.", "Think about the shape of y = x²."),
        Q("The axis of symmetry of y = ax² + bx + c is:", ["x = -b/(2a)", "x = b/a", "x = -c/a", "x = a/b"], "x = -b/(2a)", "This formula gives the x-coordinate of the vertex.", "It's a formula involving b and a."),
        Q("If a > 0 in y = ax², the parabola opens:", ["Upward", "Downward", "Left", "Right"], "Upward", "Positive 'a' makes a U-shape; negative 'a' makes an inverted U.", "Think about the sign controlling direction."),
        Q("What is the quadratic formula?", ["x = (-b ± √(b²-4ac))/(2a)", "x = -b/2a", "x = b² - 4ac", "x = a + b + c"], "x = (-b ± √(b²-4ac))/(2a)", "The quadratic formula solves any ax² + bx + c = 0.", "It involves b² - 4ac under a square root."),
        Q("Factor: x² - 9", ["(x+3)(x-3)", "(x-9)(x+1)", "(x+9)(x-1)", "(x-3)(x-3)"], "(x+3)(x-3)", "This is a difference of squares: a² - b² = (a+b)(a-b).", "Recognize this as a difference of perfect squares."),
        Q("What are the roots of x² + 4 = 0?", ["No real roots", "x = 2", "x = -2", "x = ±2"], "No real roots", "x² = -4 has no real solution since squares are non-negative.", "Can a square of a real number be negative?"),
        Q("The vertex of y = (x-3)² + 5 is at:", ["(3, 5)", "(-3, 5)", "(3, -5)", "(-3, -5)"], "(3, 5)", "In y = (x-h)² + k, the vertex is (h, k) = (3, 5).", "Read h and k directly from the equation."),
    ];

    if (topicLower.includes('function')) return [
        Q("What is the domain of f(x) = 1/x?", ["All real numbers except 0", "All real numbers", "x > 0", "x ≥ 0"], "All real numbers except 0", "Division by zero is undefined, so x ≠ 0.", "For which x-value would this function break?"),
        Q("If f(x) = 2x + 3, what is f(4)?", ["11", "8", "14", "7"], "11", "f(4) = 2(4) + 3 = 11.", "Substitute 4 for every x."),
        Q("What does f(g(x)) represent?", ["Function composition", "Addition", "Multiplication", "Division"], "Function composition", "f(g(x)) means apply g first, then f to the result.", "Think about nesting one function inside another."),
        Q("Which is an even function?", ["f(x) = x²", "f(x) = x³", "f(x) = x", "f(x) = 2x + 1"], "f(x) = x²", "Even functions satisfy f(-x) = f(x). (-x)² = x².", "Even functions are symmetric about the y-axis."),
        Q("The range of f(x) = x² is:", ["y ≥ 0", "All real numbers", "y > 0", "y ≤ 0"], "y ≥ 0", "x² is always non-negative, so the output is 0 or greater.", "Can a squared number ever be negative?"),
        Q("If f(x) = x + 1, what is f(f(3))?", ["5", "4", "6", "3"], "5", "f(3) = 4, then f(4) = 5.", "Apply the function twice."),
        Q("A function that passes the vertical line test:", ["Has exactly one output for each input", "Has multiple outputs", "Is always linear", "Is always curved"], "Has exactly one output for each input", "If any vertical line crosses the graph more than once, it's not a function.", "Each x can map to only one y."),
        Q("The inverse of f(x) = x + 5 is:", ["f⁻¹(x) = x - 5", "f⁻¹(x) = x + 5", "f⁻¹(x) = 5x", "f⁻¹(x) = x/5"], "f⁻¹(x) = x - 5", "To find the inverse, swap x and y, then solve for y.", "Undo the original operation."),
        Q("What is the domain of f(x) = √x?", ["x ≥ 0", "All real numbers", "x > 0", "x ≤ 0"], "x ≥ 0", "You can't take the square root of a negative number (in reals).", "What kind of numbers can go under a square root?"),
        Q("A piecewise function is:", ["Defined by different rules for different input ranges", "Always a straight line", "Undefined everywhere", "Only defined at one point"], "Defined by different rules for different input ranges", "Different formulas apply depending on which interval x falls in.", "Think of a function with multiple 'pieces'."),
    ];

    if (topicLower.includes('trigonometry')) return [
        Q("What is sin(90°)?", ["1", "0", "-1", "0.5"], "1", "The sine of 90 degrees equals 1.", "Think about the unit circle at the top."),
        Q("In a right triangle, SOH-CAH-TOA: what does CAH stand for?", ["Cosine = Adjacent/Hypotenuse", "Cosine = Adjacent/Horizontal", "Cosine = Angle/Hypotenuse", "Cosine = Arc/Height"], "Cosine = Adjacent/Hypotenuse", "CAH: Cosine equals Adjacent over Hypotenuse.", "Break down each letter of the mnemonic."),
        Q("What is the period of sin(x)?", ["2π", "π", "π/2", "4π"], "2π", "The sine function repeats every 2π radians.", "How far must you go before the wave pattern repeats?"),
        Q("tan(45°) equals:", ["1", "0", "√2", "√3"], "1", "tan(45°) = sin(45°)/cos(45°) = 1.", "At 45°, opposite and adjacent sides are equal."),
        Q("cos(0°) equals:", ["1", "0", "-1", "0.5"], "1", "At 0°, cosine is at its maximum value of 1.", "Think about the starting point on the unit circle."),
        Q("What is sin(30°)?", ["0.5", "1", "√3/2", "0"], "0.5", "sin(30°) = 1/2 = 0.5.", "This is one of the special angle values to memorize."),
        Q("The Pythagorean identity is:", ["sin²θ + cos²θ = 1", "sinθ + cosθ = 1", "tan²θ + 1 = sin²θ", "sin²θ - cos²θ = 1"], "sin²θ + cos²θ = 1", "This fundamental identity holds for all angles.", "It relates sine and cosine squared."),
        Q("What is cos(180°)?", ["-1", "0", "1", "0.5"], "-1", "At 180° the point on the unit circle is (-1, 0).", "Think about the opposite side of the unit circle from 0°."),
        Q("tan(θ) is defined as:", ["sin(θ)/cos(θ)", "cos(θ)/sin(θ)", "sin(θ)·cos(θ)", "1/sin(θ)"], "sin(θ)/cos(θ)", "Tangent is the ratio of sine to cosine.", "SOH-CAH-TOA: tangent = opposite/adjacent."),
        Q("How many degrees are in π radians?", ["180°", "360°", "90°", "270°"], "180°", "π radians = 180 degrees. This is a fundamental conversion.", "A half circle is π radians."),
    ];

    if (topicLower.includes('probability')) return [
        Q("What is the probability of flipping heads on a fair coin?", ["1/2", "1/3", "1/4", "1"], "1/2", "A fair coin has 2 equally likely outcomes.", "How many favorable outcomes out of total outcomes?"),
        Q("If you roll a die, what's P(even number)?", ["1/2", "1/3", "1/6", "2/3"], "1/2", "Even numbers: 2, 4, 6 — that's 3 out of 6 = 1/2.", "Count the even numbers on a standard die."),
        Q("What is 5! (5 factorial)?", ["120", "60", "24", "720"], "120", "5! = 5 × 4 × 3 × 2 × 1 = 120.", "Multiply all integers from 5 down to 1."),
        Q("Two events are independent if:", ["P(A∩B) = P(A)·P(B)", "P(A∩B) = 0", "P(A) = P(B)", "P(A|B) = P(B|A)"], "P(A∩B) = P(A)·P(B)", "Independent events: knowing one doesn't affect the other's probability.", "Independence means no influence between events."),
        Q("Mutually exclusive events cannot:", ["Occur at the same time", "Be calculated", "Be independent", "Have probabilities"], "Occur at the same time", "If A happens, B cannot happen, and vice versa.", "Think about rolling a 3 AND a 5 on one die."),
        Q("The probability of any event is always between:", ["0 and 1", "-1 and 1", "0 and 100", "1 and 10"], "0 and 1", "P = 0 means impossible, P = 1 means certain.", "Probability can never be negative or greater than 1."),
        Q("P(A or B) for mutually exclusive events equals:", ["P(A) + P(B)", "P(A) × P(B)", "P(A) - P(B)", "P(A) / P(B)"], "P(A) + P(B)", "For mutually exclusive events, just add the probabilities.", "Since they can't overlap, there's no double-counting."),
        Q("A sample space is:", ["The set of all possible outcomes", "A single outcome", "The probability of an event", "A type of experiment"], "The set of all possible outcomes", "For a coin flip, S = {Heads, Tails}.", "List everything that could happen."),
        Q("What is a combination (vs permutation)?", ["Order doesn't matter", "Order matters", "Only one element", "No repetition allowed"], "Order doesn't matter", "Combinations count selections regardless of arrangement.", "Choosing a team vs assigning positions."),
        Q("The complement of event A is:", ["Everything in the sample space that is NOT A", "The same as A", "Always empty", "Always certain"], "Everything in the sample space that is NOT A", "P(A') = 1 - P(A).", "What's left when you remove A from all outcomes."),
    ];

    // --- SCIENCE ---
    if (topicLower.includes('newton') || topicLower.includes('motion')) return [
        Q("Newton's First Law is also called the Law of:", ["Inertia", "Gravity", "Acceleration", "Action-Reaction"], "Inertia", "Objects resist changes to their state of motion.", "What property keeps objects doing what they're doing?"),
        Q("F = ma: if mass doubles and force stays the same, acceleration:", ["Halves", "Doubles", "Stays the same", "Quadruples"], "Halves", "a = F/m, so doubling m halves a.", "Rearrange the formula to solve for a."),
        Q("Newton's Third Law states every action has:", ["An equal and opposite reaction", "A greater reaction", "No reaction", "A delayed reaction"], "An equal and opposite reaction", "Forces always come in equal and opposite pairs.", "Think about pushing against a wall."),
        Q("The SI unit of force is:", ["Newton", "Joule", "Watt", "Pascal"], "Newton", "Force is measured in Newtons (N), where 1 N = 1 kg·m/s².", "Named after the scientist who defined the laws of motion."),
        Q("Acceleration is defined as:", ["Rate of change of velocity", "Rate of change of distance", "Total distance traveled", "Force times mass"], "Rate of change of velocity", "a = Δv/Δt — how quickly velocity changes.", "It's not about speed itself, but how speed changes."),
        Q("An object at rest tends to:", ["Stay at rest unless acted on by a force", "Start moving on its own", "Accelerate downward", "Vibrate slightly"], "Stay at rest unless acted on by a force", "This is Newton's First Law (inertia).", "What keeps a book sitting still on a table?"),
        Q("If F = 10N and m = 2kg, what is the acceleration?", ["5 m/s²", "20 m/s²", "12 m/s²", "8 m/s²"], "5 m/s²", "a = F/m = 10/2 = 5 m/s².", "Divide force by mass."),
        Q("Friction always acts:", ["Opposite to the direction of motion", "In the same direction as motion", "Upward", "Randomly"], "Opposite to the direction of motion", "Friction resists relative motion between surfaces.", "It tries to slow things down."),
        Q("Weight is defined as:", ["Mass times gravitational acceleration (W = mg)", "Just mass", "Volume times density", "Force divided by area"], "Mass times gravitational acceleration (W = mg)", "Weight is a force, measured in Newtons.", "It depends on both mass and gravity."),
        Q("Terminal velocity occurs when:", ["Air resistance equals gravitational force", "An object stops moving", "Acceleration is maximum", "Speed is zero"], "Air resistance equals gravitational force", "Net force is zero, so acceleration stops and speed remains constant.", "The two opposing forces balance out."),
    ];

    if (topicLower.includes('energy') || topicLower.includes('work')) return [
        Q("Kinetic energy depends on:", ["Mass and velocity", "Mass and height", "Force and distance", "Time and speed"], "Mass and velocity", "KE = ½mv². It depends on mass and the square of velocity.", "The formula involves mass and how fast something moves."),
        Q("Which has more gravitational PE: a ball at 10m or 5m?", ["10m", "5m", "Same", "Cannot determine"], "10m", "PE = mgh. Greater height means more potential energy.", "Higher position = more stored energy."),
        Q("The law of conservation of energy states:", ["Energy cannot be created or destroyed", "Energy always increases", "Energy is always lost as heat", "Energy only exists as kinetic"], "Energy cannot be created or destroyed", "Energy transforms between forms but the total stays constant.", "Think about what 'conservation' means."),
        Q("Work is defined as:", ["Force times distance (W = Fd)", "Mass times velocity", "Energy divided by time", "Force divided by area"], "Force times distance (W = Fd)", "Work is done when a force moves an object over a distance.", "Both force and movement in its direction are needed."),
        Q("Power is the rate of doing:", ["Work", "Force", "Acceleration", "Energy storage"], "Work", "Power = Work/Time. It measures how fast energy is used.", "Watts measure how quickly work gets done."),
        Q("The SI unit of energy is:", ["Joule", "Newton", "Watt", "Kilogram"], "Joule", "1 Joule = 1 Newton × 1 meter.", "Named after James Prescott Joule."),
        Q("When a ball is thrown upward, at the highest point:", ["KE = 0, PE is maximum", "PE = 0, KE is maximum", "Both are zero", "Both are maximum"], "KE = 0, PE is maximum", "At the peak, velocity is momentarily zero (no KE), and height is max (max PE).", "What happens to speed at the very top?"),
        Q("Elastic potential energy is stored in:", ["Stretched or compressed springs", "Moving objects", "Raised objects", "Chemical bonds"], "Stretched or compressed springs", "PE_elastic = ½kx², where k is spring constant and x is displacement.", "Think about what stores energy when deformed."),
        Q("If velocity doubles, kinetic energy:", ["Quadruples", "Doubles", "Stays the same", "Halves"], "Quadruples", "KE = ½mv². Since v is squared, doubling v gives 4× KE.", "Look at the exponent on velocity in the KE formula."),
        Q("Efficiency is calculated as:", ["(Useful energy output / Total energy input) × 100%", "Total energy × 100%", "Input energy - Output energy", "Power × Time"], "(Useful energy output / Total energy input) × 100%", "No machine is 100% efficient due to energy losses (usually heat).", "What fraction of input energy is actually useful?"),
    ];

    if (topicLower.includes('atom')) return [
        Q("What particle has a positive charge?", ["Proton", "Electron", "Neutron", "Photon"], "Proton", "Protons are positively charged and found in the nucleus.", "It's in the center of the atom with a + charge."),
        Q("The atomic number represents the number of:", ["Protons", "Neutrons", "Electrons and neutrons", "Total particles"], "Protons", "Atomic number = number of protons, which defines the element.", "This number defines which element it is."),
        Q("Electrons orbit the nucleus in:", ["Energy levels/shells", "Straight lines", "Random paths", "The nucleus itself"], "Energy levels/shells", "Electrons occupy discrete energy levels around the nucleus.", "Think about organized layers around the center."),
        Q("Neutrons have:", ["No charge", "Positive charge", "Negative charge", "Variable charge"], "No charge", "Neutrons are electrically neutral particles in the nucleus.", "The name 'neutron' hints at their charge."),
        Q("Mass number equals:", ["Protons + Neutrons", "Protons only", "Electrons only", "Protons + Electrons"], "Protons + Neutrons", "Mass number counts the heavy particles in the nucleus.", "Which particles are in the nucleus?"),
        Q("Isotopes differ in the number of:", ["Neutrons", "Protons", "Electrons", "Energy levels"], "Neutrons", "Isotopes have the same atomic number but different mass numbers.", "Same element, different mass."),
        Q("The electron cloud model describes electrons as:", ["A probability distribution around the nucleus", "Fixed orbits", "Stationary points", "Inside the nucleus"], "A probability distribution around the nucleus", "Electrons don't follow fixed paths but exist in probability clouds.", "We can't pinpoint exact position, only likelihood."),
        Q("An ion is formed when an atom:", ["Gains or loses electrons", "Gains or loses protons", "Splits in half", "Changes its nucleus"], "Gains or loses electrons", "Gaining electrons makes a negative ion; losing makes a positive ion.", "The change in electron count creates a charge."),
        Q("The nucleus contains:", ["Protons and neutrons", "Electrons and protons", "Only protons", "Only neutrons"], "Protons and neutrons", "The nucleus is made of nucleons: protons (positive) and neutrons (neutral).", "The dense center of the atom."),
        Q("Valence electrons are found in the:", ["Outermost energy level", "Nucleus", "Innermost shell", "Between atoms"], "Outermost energy level", "Valence electrons determine chemical bonding behavior.", "The electrons farthest from the nucleus."),
    ];

    if (topicLower.includes('periodic')) return [
        Q("Elements in the same column (group) have similar:", ["Chemical properties", "Atomic mass", "Number of neutrons", "Physical size"], "Chemical properties", "Groups share similar valence electron configurations.", "What do elements in a family share?"),
        Q("Noble gases are found in Group:", ["18", "1", "7", "14"], "18", "Group 18 contains He, Ne, Ar, Kr, Xe, Rn — the noble gases.", "These are the most stable, least reactive elements."),
        Q("As you move left to right across a period, atomic radius generally:", ["Decreases", "Increases", "Stays the same", "Doubles"], "Decreases", "More protons pull electrons closer despite same shell count.", "More nuclear charge with same number of shells."),
        Q("Metals are generally found on which side of the periodic table?", ["Left side", "Right side", "Top only", "Bottom only"], "Left side", "Metals occupy the left and center; nonmetals are on the right.", "Most elements on the left tend to lose electrons."),
        Q("Halogens are in Group:", ["17", "1", "18", "2"], "17", "Group 17 includes F, Cl, Br, I — highly reactive nonmetals.", "They need just one more electron to fill their shell."),
        Q("Electronegativity generally increases:", ["Left to right across a period", "Top to bottom in a group", "Toward the bottom-left", "Randomly"], "Left to right across a period", "Atoms on the right pull electrons more strongly.", "Which direction do atoms want electrons more?"),
        Q("The alkali metals are in Group:", ["1", "2", "17", "18"], "1", "Group 1 (Li, Na, K, etc.) are highly reactive metals.", "They have one valence electron to give away."),
        Q("A period in the periodic table is a:", ["Horizontal row", "Vertical column", "Diagonal line", "Single element"], "Horizontal row", "Periods go left to right; groups go top to bottom.", "Rows vs columns."),
        Q("Transition metals are found in:", ["Groups 3-12", "Group 1", "Group 18", "Group 17"], "Groups 3-12", "They are in the middle block and include iron, copper, gold.", "The large block in the center of the table."),
        Q("Ionization energy generally increases:", ["Bottom to top in a group", "Top to bottom in a group", "Right to left in a period", "Randomly"], "Bottom to top in a group", "Smaller atoms hold their electrons more tightly.", "Closer electrons are harder to remove."),
    ];

    if (topicLower.includes('cell')) return [
        Q("Which organelle is the 'powerhouse of the cell'?", ["Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus"], "Mitochondria", "Mitochondria produce ATP through cellular respiration.", "Which organelle generates energy?"),
        Q("The cell membrane is best described as:", ["Selectively permeable", "Completely impermeable", "Rigid and fixed", "Only found in plant cells"], "Selectively permeable", "It allows some substances through while blocking others.", "It's choosy about what enters and exits."),
        Q("Which structure is found in plant cells but NOT animal cells?", ["Cell wall", "Cell membrane", "Mitochondria", "Ribosomes"], "Cell wall", "Plant cells have a rigid cell wall made of cellulose.", "What gives plants their rigid structure?"),
        Q("The nucleus contains:", ["DNA (genetic material)", "Water only", "ATP", "Nothing"], "DNA (genetic material)", "The nucleus houses chromosomes and directs cell activities.", "Where is the cell's instruction manual stored?"),
        Q("Ribosomes are responsible for:", ["Protein synthesis", "Energy production", "Cell division", "Storing water"], "Protein synthesis", "Ribosomes translate mRNA into proteins.", "The cell's protein-making factories."),
        Q("The Golgi apparatus functions to:", ["Package and ship proteins", "Produce energy", "Store DNA", "Perform photosynthesis"], "Package and ship proteins", "It modifies, sorts, and packages proteins for transport.", "Think of it as the cell's post office."),
        Q("Chloroplasts are found in:", ["Plant cells only", "Animal cells only", "Both equally", "Neither"], "Plant cells only", "Chloroplasts contain chlorophyll for photosynthesis.", "Which cells perform photosynthesis?"),
        Q("Osmosis is the movement of:", ["Water across a semi-permeable membrane", "Solute molecules", "Gases only", "Proteins"], "Water across a semi-permeable membrane", "Water moves from low solute to high solute concentration.", "A special type of diffusion involving water."),
        Q("Lysosomes function as the cell's:", ["Digestive system", "Brain", "Skeleton", "Power plant"], "Digestive system", "They contain enzymes that break down waste and old organelles.", "They break things down inside the cell."),
        Q("The endoplasmic reticulum (ER) comes in two types:", ["Rough and smooth", "Large and small", "Inner and outer", "Fast and slow"], "Rough and smooth", "Rough ER has ribosomes; smooth ER handles lipid synthesis.", "One type is bumpy, the other is not."),
    ];

    if (topicLower.includes('genetic') || topicLower.includes('dna')) return [
        Q("DNA stands for:", ["Deoxyribonucleic acid", "Dinitrogen acid", "Dynamic nuclear assembly", "Data nucleotide array"], "Deoxyribonucleic acid", "DNA is the molecule that carries genetic instructions.", "The 'D' stands for deoxy, referring to a missing oxygen."),
        Q("In a Punnett square, a heterozygous genotype is:", ["Aa", "AA", "aa", "None of these"], "Aa", "Heterozygous means having two different alleles.", "Hetero means different."),
        Q("Which base pairs with Adenine in DNA?", ["Thymine", "Cytosine", "Guanine", "Uracil"], "Thymine", "In DNA: A-T and G-C are the base pairs.", "Remember: A pairs with T in DNA."),
        Q("The shape of DNA is a:", ["Double helix", "Single strand", "Triple helix", "Square lattice"], "Double helix", "Watson and Crick discovered DNA's double helix structure in 1953.", "Think about a twisted ladder."),
        Q("RNA differs from DNA by having:", ["Uracil instead of Thymine", "Thymine instead of Adenine", "No bases at all", "Double strands always"], "Uracil instead of Thymine", "RNA uses U instead of T, and is typically single-stranded.", "One base is swapped out."),
        Q("A dominant allele is expressed when:", ["At least one copy is present", "Two copies are needed", "No copies are needed", "It's always hidden"], "At least one copy is present", "Dominant alleles mask recessive ones (Aa shows dominant phenotype).", "One copy is enough to see the trait."),
        Q("Mitosis produces:", ["Two identical daughter cells", "Four unique cells", "One large cell", "Sperm and egg cells"], "Two identical daughter cells", "Mitosis is for growth and repair, producing genetic copies.", "Cell division for growth — copies, not unique cells."),
        Q("Meiosis produces:", ["Four genetically unique cells", "Two identical cells", "One large cell", "Eight cells"], "Four genetically unique cells", "Meiosis creates gametes (sex cells) with half the chromosomes.", "This is for creating eggs and sperm."),
        Q("A mutation is:", ["A change in the DNA sequence", "Normal cell division", "Protein synthesis", "RNA translation"], "A change in the DNA sequence", "Mutations can be beneficial, harmful, or neutral.", "An alteration in the genetic code."),
        Q("Genotype refers to:", ["The genetic makeup of an organism", "The physical appearance", "The environment", "The diet"], "The genetic makeup of an organism", "Genotype is the set of alleles (e.g., Aa), while phenotype is the observable trait.", "Genes vs appearance."),
    ];

    // --- COMPUTER SCIENCE ---
    if (topicLower.includes('variable') || topicLower.includes('data type')) return [
        Q("Which is NOT a primitive data type?", ["Array", "Integer", "Boolean", "String"], "Array", "Array is a data structure, not a primitive type.", "Primitives hold single values. Which holds multiple?"),
        Q("What is the result of 10 / 3 in integer division?", ["3", "3.33", "4", "10"], "3", "Integer division truncates the decimal part.", "When dividing integers, the remainder is discarded."),
        Q("A variable declared as 'const' means:", ["Its value cannot be reassigned", "It's automatically deleted", "It's always a number", "It can only be used once"], "Its value cannot be reassigned", "const creates a read-only reference.", "Think about the word 'constant'."),
        Q("What does 'type casting' mean?", ["Converting data from one type to another", "Deleting a variable", "Creating a new variable", "Printing a variable's type"], "Converting data from one type to another", "Type casting changes how data is interpreted.", "It's like translating between data types."),
        Q("A boolean variable can hold:", ["True or false", "Any number", "Text only", "Multiple values"], "True or false", "Booleans represent binary states: true/false, yes/no, 1/0.", "Just two possible values."),
        Q("What is a string?", ["A sequence of characters", "A number", "A boolean", "A function"], "A sequence of characters", "Strings store text, enclosed in quotes.", "Think about letters, words, and sentences."),
        Q("'let' vs 'var' in JavaScript: 'let' has:", ["Block scope", "Global scope only", "No scope", "Function scope only"], "Block scope", "let is scoped to the nearest enclosing block {}.", "One is more modern and more restricted."),
        Q("What is a float/double?", ["A decimal number type", "A text type", "A boolean type", "An error type"], "A decimal number type", "Floats/doubles store numbers with decimal points like 3.14.", "Numbers with dots in them."),
        Q("null represents:", ["Intentional absence of a value", "The number zero", "An empty string", "A boolean false"], "Intentional absence of a value", "null means deliberately set to 'nothing'.", "It's not zero, it's literally nothing."),
        Q("What is 'undefined' in JavaScript?", ["A variable declared but not assigned", "A syntax error", "A number", "A deleted variable"], "A variable declared but not assigned", "When you create a variable but don't give it a value.", "Declared but empty."),
    ];

    if (topicLower.includes('control flow') || topicLower.includes('loop')) return [
        Q("How many times does for(i=0; i<5; i++) execute?", ["5", "4", "6", "Infinite"], "5", "i goes 0,1,2,3,4 — five iterations.", "Count from 0 up to but not including 5."),
        Q("A 'while(true)' loop without a break will:", ["Run forever", "Run once", "Not compile", "Run twice"], "Run forever", "The condition is always true, creating an infinite loop.", "What happens when the condition never becomes false?"),
        Q("The 'break' statement in a loop:", ["Exits the loop immediately", "Skips to the next iteration", "Ends the program", "Restarts the loop"], "Exits the loop immediately", "break terminates the nearest enclosing loop.", "Think about 'breaking out' of a loop."),
        Q("What is a nested loop?", ["A loop inside another loop", "Two loops side by side", "A loop that runs once", "A recursive function"], "A loop inside another loop", "Nested loops have an inner loop that runs completely for each iteration of the outer loop.", "Think about putting one loop inside another."),
        Q("The 'continue' statement:", ["Skips the rest of the current iteration", "Exits the loop", "Stops the program", "Repeats the previous iteration"], "Skips the rest of the current iteration", "continue jumps to the next iteration of the loop.", "It skips ahead, unlike break which exits."),
        Q("A do-while loop always runs at least:", ["Once", "Twice", "Zero times", "Three times"], "Once", "The condition is checked after the first execution.", "The body runs before the condition is tested."),
        Q("An if-else statement provides:", ["Two branches of execution", "A loop", "Error handling", "Variable declaration"], "Two branches of execution", "If the condition is true, one block runs; otherwise, the else block runs.", "Either this or that."),
        Q("A switch statement is best for:", ["Comparing one value against many cases", "Looping", "Exception handling", "File operations"], "Comparing one value against many cases", "Switch checks a variable against multiple constant values.", "Like a menu of options to match against."),
        Q("A for-each loop iterates over:", ["Each element in a collection", "A fixed number of times", "Random elements", "Only arrays"], "Each element in a collection", "It visits every item without needing an index counter.", "No need to manage an index variable."),
        Q("Short-circuit evaluation means:", ["Stopping evaluation as soon as the result is determined", "Running all conditions always", "Skipping loops", "A compiler optimization only"], "Stopping evaluation as soon as the result is determined", "In (false && x), x is never evaluated because the first operand is false.", "Why check more if you already know the answer?"),
    ];

    if (topicLower.includes('function') && topicLower.includes('method')) return [
        Q("What does a 'return' statement do?", ["Sends a value back to the caller", "Prints a value", "Deletes a variable", "Starts a loop"], "Sends a value back to the caller", "return exits the function and passes a value back.", "It's how functions give results back."),
        Q("Function parameters are:", ["Variables that receive input values", "Global variables", "Return values", "Error messages"], "Variables that receive input values", "Parameters are placeholders for the arguments passed to a function.", "They act as the function's input slots."),
        Q("What is 'scope' in programming?", ["Where a variable can be accessed", "A function's speed", "A variable's data type", "A loop counter"], "Where a variable can be accessed", "Scope determines the visibility and lifetime of variables.", "Think about which parts of code can 'see' a variable."),
        Q("A void function:", ["Does not return a value", "Returns zero", "Cannot take parameters", "Always crashes"], "Does not return a value", "Void means the function performs an action but doesn't send back a result.", "Think void = empty return."),
        Q("Recursion is when:", ["A function calls itself", "Two functions call each other", "A loop runs forever", "A variable references itself"], "A function calls itself", "Recursive functions solve problems by breaking them into smaller subproblems.", "Like Russian nesting dolls — each opens to reveal a smaller version."),
        Q("An argument vs a parameter:", ["Arguments are actual values; parameters are placeholders", "They are the same", "Arguments are always numbers", "Parameters are always strings"], "Arguments are actual values; parameters are placeholders", "Parameters are in the definition; arguments are passed during the call.", "Definition vs call."),
        Q("Default parameters provide:", ["A fallback value if no argument is passed", "Required values", "Error messages", "Return types"], "A fallback value if no argument is passed", "If the caller doesn't provide a value, the default is used.", "A safety net for missing arguments."),
        Q("A pure function:", ["Produces the same output for the same input with no side effects", "Always returns void", "Modifies global state", "Requires user input"], "Produces the same output for the same input with no side effects", "Pure functions are predictable and testable.", "Given the same input, always the same output."),
        Q("Method overloading means:", ["Multiple methods with the same name but different parameters", "Methods that override each other", "Methods that call themselves", "Methods that do nothing"], "Multiple methods with the same name but different parameters", "The correct method is chosen based on the arguments provided.", "Same name, different signatures."),
        Q("A callback function is:", ["A function passed as an argument to another function", "A function that calls itself", "A function that returns void", "A function that loops"], "A function passed as an argument to another function", "The receiving function 'calls back' the passed function when needed.", "Passing instructions for later execution."),
    ];

    if (topicLower.includes('array') || topicLower.includes('list')) return [
        Q("What is the index of the first element in most arrays?", ["0", "1", "-1", "None"], "0", "Most programming languages use zero-based indexing.", "Arrays typically start counting from zero."),
        Q("To add an element to the end of an array, you use:", ["push()", "pop()", "shift()", "unshift()"], "push()", "push() appends an element to the end of an array.", "Think about pushing something onto a stack."),
        Q("What is the time complexity of accessing an array element by index?", ["O(1)", "O(n)", "O(log n)", "O(n²)"], "O(1)", "Direct index access is constant time regardless of array size.", "You jump directly to the position — no searching needed."),
        Q("pop() removes an element from:", ["The end of an array", "The beginning", "The middle", "A random position"], "The end of an array", "pop() removes and returns the last element.", "The opposite of push."),
        Q("A 2D array is:", ["An array of arrays", "A single row", "A linked list", "A tree"], "An array of arrays", "Think of it as a grid or matrix with rows and columns.", "Like a spreadsheet with rows and columns."),
        Q("The length of an array gives:", ["The number of elements", "The memory size", "The index of the last element", "The data type"], "The number of elements", "arr.length returns how many items the array contains.", "Count all the items."),
        Q("Searching for an element in an unsorted array is:", ["O(n) — linear search", "O(1)", "O(log n)", "O(n²)"], "O(n) — linear search", "You must check each element one by one in the worst case.", "No shortcuts in an unsorted collection."),
        Q("A linked list differs from an array by:", ["Using nodes with pointers instead of contiguous memory", "Being faster for all operations", "Having fixed size", "Storing only numbers"], "Using nodes with pointers instead of contiguous memory", "Each node points to the next, allowing dynamic sizing.", "Connected nodes vs a block of memory."),
        Q("slice() on an array:", ["Returns a shallow copy of a portion", "Deletes elements", "Sorts the array", "Reverses the array"], "Returns a shallow copy of a portion", "slice(start, end) extracts without modifying the original.", "Copy a piece without changing the original."),
        Q("map() on an array:", ["Creates a new array by transforming each element", "Finds one element", "Removes elements", "Sorts elements"], "Creates a new array by transforming each element", "arr.map(fn) applies fn to every element and returns a new array.", "Transform each item and collect results."),
    ];

    if (topicLower.includes('object-oriented') || topicLower.includes('oop')) return [
        Q("Encapsulation means:", ["Bundling data and methods, hiding internals", "Creating multiple objects", "Inheriting from a parent", "Overriding methods"], "Bundling data and methods, hiding internals", "Encapsulation restricts direct access to object components.", "Think about putting things in a capsule."),
        Q("What is inheritance in OOP?", ["A class receiving properties from another class", "Creating instances", "Hiding data", "Method overloading"], "A class receiving properties from another class", "A child class inherits attributes and methods from a parent class.", "Like children inheriting traits from parents."),
        Q("Polymorphism allows:", ["Same interface, different implementations", "Only one class to exist", "Variables to change type", "Functions to take no arguments"], "Same interface, different implementations", "Different classes can provide their own implementation of the same method.", "Poly = many, morph = forms."),
        Q("Abstraction in OOP means:", ["Showing only essential details, hiding complexity", "Making everything public", "Removing all methods", "Using only integers"], "Showing only essential details, hiding complexity", "Users interact with a simplified interface.", "Like driving a car without knowing how the engine works."),
        Q("A class is:", ["A blueprint for creating objects", "An instance of an object", "A variable type", "A loop construct"], "A blueprint for creating objects", "Classes define properties and methods that objects will have.", "Template vs actual item."),
        Q("An object is:", ["An instance of a class", "A class definition", "A data type", "A function"], "An instance of a class", "Objects are created from class blueprints with specific values.", "If the class is a cookie cutter, the object is the cookie."),
        Q("A constructor is:", ["A special method called when creating an object", "A loop type", "A variable", "A file format"], "A special method called when creating an object", "It initializes the object's state when instantiated.", "It runs automatically when you create a new object."),
        Q("Method overriding means:", ["A subclass provides its own implementation of a parent method", "Creating new methods", "Deleting methods", "Making methods private"], "A subclass provides its own implementation of a parent method", "The child's version replaces the parent's for that class.", "Same method name but different behavior in the child."),
        Q("An interface defines:", ["A contract that classes must implement", "A complete class", "A variable", "A database"], "A contract that classes must implement", "Interfaces specify what methods a class must have, not how.", "Rules without implementation."),
        Q("The 'this' keyword refers to:", ["The current object instance", "The parent class", "A global variable", "The next object"], "The current object instance", "this points to the object that owns the currently executing method.", "It refers to 'myself' — the current object."),
    ];

    if (topicLower.includes('algorithm')) return [
        Q("What does O(n) time complexity mean?", ["Linear time — grows proportionally with input", "Constant time", "Quadratic time", "Logarithmic time"], "Linear time — grows proportionally with input", "O(n) means the time grows linearly as input size increases.", "If input doubles, time roughly doubles."),
        Q("Binary search requires the data to be:", ["Sorted", "Unsorted", "Stored in a linked list", "In a stack"], "Sorted", "Binary search works by repeatedly halving a sorted collection.", "You need to know which half to discard."),
        Q("Which sort has O(n log n) average time?", ["Merge sort", "Bubble sort", "Selection sort", "Insertion sort"], "Merge sort", "Merge sort divides, sorts halves, and merges — O(n log n).", "It uses divide-and-conquer strategy."),
        Q("Bubble sort works by:", ["Repeatedly swapping adjacent elements if they are in wrong order", "Dividing the array", "Using a hash table", "Recursion only"], "Repeatedly swapping adjacent elements if they are in wrong order", "Larger elements 'bubble up' to the end with each pass.", "Compare neighbors and swap."),
        Q("O(1) means:", ["Constant time — doesn't depend on input size", "Linear time", "Quadratic time", "Infinite time"], "Constant time — doesn't depend on input size", "The operation takes the same time regardless of data size.", "Always the same speed no matter what."),
        Q("A hash table provides average lookup time of:", ["O(1)", "O(n)", "O(log n)", "O(n²)"], "O(1)", "Hash functions map keys directly to positions for near-instant retrieval.", "Index directly into the right bucket."),
        Q("Recursion requires:", ["A base case to stop", "An infinite loop", "No return value", "Global variables"], "A base case to stop", "Without a base case, recursion leads to stack overflow.", "What prevents infinite self-calling?"),
        Q("BFS uses which data structure?", ["Queue", "Stack", "Heap", "Array only"], "Queue", "BFS processes nodes level by level using FIFO ordering.", "First In, First Out for level-by-level exploration."),
        Q("The space complexity of an algorithm measures:", ["Memory usage relative to input size", "Execution speed", "Code line count", "Number of variables"], "Memory usage relative to input size", "It tracks how much additional memory the algorithm needs.", "Time tells speed, this tells memory."),
        Q("Greedy algorithms:", ["Make locally optimal choices at each step", "Always find the global optimum", "Use backtracking", "Require sorting first"], "Make locally optimal choices at each step", "They pick the best immediate option but may not find the best overall solution.", "Take the best option right now without looking ahead."),
    ];

    // --- HISTORY ---
    if (topicLower.includes('ancient') || topicLower.includes('civilization')) return [
        Q("Who invented the first known writing system?", ["Sumerians", "Ancient Egyptians", "Ancient Greeks", "Ancient Chinese"], "Sumerians", "Cuneiform developed around 3400 BCE in Mesopotamia.", "Between the Tigris and Euphrates rivers."),
        Q("The Roman Republic became an Empire under:", ["Augustus", "Julius Caesar", "Nero", "Constantine"], "Augustus", "Augustus (Octavian) became the first Roman Emperor in 27 BCE.", "He was Julius Caesar's adopted heir."),
        Q("The Great Pyramid of Giza was built for:", ["Pharaoh Khufu", "Pharaoh Tutankhamun", "Cleopatra", "Ramesses II"], "Pharaoh Khufu", "Built around 2560 BCE as a tomb for Pharaoh Khufu.", "It's the oldest of the Seven Wonders."),
    ];

    if (topicLower.includes('medieval')) return [
        Q("Feudalism was a system based on:", ["Land ownership and loyalty", "Democracy", "Free trade", "Industrialization"], "Land ownership and loyalty", "Lords granted land to vassals in exchange for military service.", "It's about land grants in exchange for service."),
        Q("The Black Death killed approximately what fraction of Europe?", ["One-third", "One-tenth", "One-half", "One-quarter"], "One-third", "The plague killed about 25-30 million Europeans (1/3 of the population).", "It was devastating but didn't kill the majority."),
        Q("The Crusades were primarily fought to:", ["Reclaim the Holy Land", "Trade with Asia", "Discover new continents", "Spread democracy"], "Reclaim the Holy Land", "Christian European forces fought to capture Jerusalem.", "Think about religious motivation and a specific city."),
    ];

    if (topicLower.includes('renaissance')) return [
        Q("The Renaissance began in:", ["Italy", "France", "England", "Germany"], "Italy", "Florence and other Italian city-states were the birthplace.", "Think about Florence, Leonardo, and Michelangelo."),
        Q("Martin Luther's 95 Theses criticized:", ["The Catholic Church's sale of indulgences", "The monarchy", "Scientific research", "The feudal system"], "The Catholic Church's sale of indulgences", "Luther objected to the practice of selling forgiveness for sins.", "He nailed them to a church door in 1517."),
        Q("Who painted the Mona Lisa?", ["Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello"], "Leonardo da Vinci", "Da Vinci painted it between 1503-1519.", "He was also an inventor and scientist."),
    ];

    if (topicLower.includes('revolution')) return [
        Q("The Industrial Revolution began in:", ["Britain", "France", "United States", "Germany"], "Britain", "Textile manufacturing innovations started in Britain around 1760.", "Think about early factories and steam power."),
        Q("'Liberty, Equality, Fraternity' was the motto of:", ["French Revolution", "American Revolution", "Russian Revolution", "Glorious Revolution"], "French Revolution", "This became the rallying cry of the French Revolution in 1789.", "Three French words representing the revolution's ideals."),
        Q("The Declaration of Independence was signed in:", ["1776", "1789", "1812", "1750"], "1776", "July 4, 1776 — American independence from Britain.", "A date celebrated every year in the US."),
    ];

    if (topicLower.includes('world war')) return [
        Q("What event triggered World War I?", ["Assassination of Archduke Franz Ferdinand", "Invasion of Poland", "Bombing of Pearl Harbor", "Fall of the Berlin Wall"], "Assassination of Archduke Franz Ferdinand", "His assassination in Sarajevo in 1914 triggered the war.", "It happened in the Balkans in 1914."),
        Q("D-Day (June 6, 1944) was the invasion of:", ["Normandy, France", "Berlin, Germany", "Tokyo, Japan", "London, England"], "Normandy, France", "Allied forces landed on the beaches of Normandy.", "The largest seaborne invasion in history."),
        Q("Which countries formed the Axis powers in WWII?", ["Germany, Italy, Japan", "USA, UK, France", "Russia, China, India", "Spain, Portugal, Brazil"], "Germany, Italy, Japan", "The three main Axis powers fought against the Allies.", "Think about the three main aggressors of WWII."),
    ];

    if (topicLower.includes('modern world') || topicLower.includes('cold war')) return [
        Q("The Cold War was primarily between:", ["USA and USSR", "USA and China", "UK and France", "Japan and Russia"], "USA and USSR", "A geopolitical rivalry between the superpowers from 1947-1991.", "Two superpowers with opposing ideologies."),
        Q("The Berlin Wall fell in:", ["1989", "1991", "1975", "2000"], "1989", "The wall fell on November 9, 1989, reunifying Berlin.", "A major symbol of the Cold War ending."),
        Q("Decolonization primarily occurred after:", ["World War II", "World War I", "The Renaissance", "The Industrial Revolution"], "World War II", "Most colonies in Africa and Asia gained independence after WWII.", "Colonial powers were weakened by the war."),
    ];

    // --- ARTIFICIAL INTELLIGENCE ---
    if (topicLower.includes('introduction to ai') || (topicLower.includes('ai') && !topicLower.includes('planning') && !topicLower.includes('ethic') && !topicLower.includes('nlp') && !topicLower.includes('search') && !topicLower.includes('knowledge'))) return [
        Q("The Turing Test evaluates:", ["Whether a machine can exhibit intelligent behavior indistinguishable from a human", "A computer's processing speed", "Memory capacity", "Network connectivity"], "Whether a machine can exhibit intelligent behavior indistinguishable from a human", "Proposed by Alan Turing in 1950 to test machine intelligence.", "Can a machine fool a human into thinking it's human?"),
        Q("Narrow AI (Weak AI) is designed to:", ["Perform a specific task", "Think like a human", "Be conscious", "Replace all human jobs"], "Perform a specific task", "Narrow AI excels at one thing (e.g. chess, image recognition) but can't generalize.", "Think about Siri or a chess engine — they do one thing well."),
        Q("Who is considered the father of AI?", ["John McCarthy", "Alan Turing", "Elon Musk", "Geoffrey Hinton"], "John McCarthy", "McCarthy coined the term 'Artificial Intelligence' in 1956 at the Dartmouth Conference.", "He named the field at a famous 1956 conference."),
        Q("General AI (Strong AI) would be able to:", ["Understand and learn any intellectual task a human can", "Only play chess", "Only recognize images", "Only process language"], "Understand and learn any intellectual task a human can", "AGI would match human-level intelligence across all domains.", "Think about human-level versatility in intelligence."),
    ];

    if (topicLower.includes('search algorithm')) return [
        Q("BFS explores nodes:", ["Level by level (breadth-first)", "Deepest nodes first", "Randomly", "By cost only"], "Level by level (breadth-first)", "BFS explores all neighbors before moving deeper.", "Think about exploring outward in layers."),
        Q("A* search uses:", ["Heuristic + actual cost (f = g + h)", "Only actual cost", "Only heuristic", "Random selection"], "Heuristic + actual cost (f = g + h)", "A* combines path cost (g) with estimated remaining cost (h).", "It balances what you've spent with what you estimate is left."),
        Q("DFS uses which data structure?", ["Stack", "Queue", "Heap", "Hash table"], "Stack", "DFS uses a stack (LIFO) to explore deepest paths first.", "Last In, First Out — go deep before backtracking."),
        Q("Minimax is used in:", ["Game-playing (adversarial search)", "Sorting data", "Database queries", "File compression"], "Game-playing (adversarial search)", "Minimax evaluates game trees for two-player zero-sum games.", "Think about chess or tic-tac-toe."),
    ];

    if (topicLower.includes('knowledge representation')) return [
        Q("Propositional logic uses:", ["True/false statements connected by AND, OR, NOT", "Numerical equations", "Probability distributions", "Neural connections"], "True/false statements connected by AND, OR, NOT", "Propositional logic deals with propositions and logical connectives.", "Think about statements that are simply true or false."),
        Q("First-order logic extends propositional logic with:", ["Quantifiers (∀, ∃) and predicates", "More operators", "Faster computation", "Graphical interfaces"], "Quantifiers (∀, ∃) and predicates", "FOL adds 'for all' and 'there exists' quantifiers.", "It can express 'all dogs are mammals' — propositional logic cannot."),
        Q("An ontology in AI represents:", ["Formal knowledge about a domain's concepts and relationships", "A neural network architecture", "A search algorithm", "A programming language"], "Formal knowledge about a domain's concepts and relationships", "Ontologies structure knowledge into hierarchies and relations.", "Think about organizing concepts like a taxonomy."),
    ];

    if (topicLower.includes('planning')) return [
        Q("STRIPS is a:", ["Classical AI planning language", "Programming language", "Database system", "Neural network type"], "Classical AI planning language", "STRIPS defines actions with preconditions and effects for goal-based planning.", "It was one of the earliest planning formalisms."),
        Q("A goal-based agent selects actions to:", ["Achieve a desired state", "React to stimuli only", "Maximize randomness", "Minimize computation"], "Achieve a desired state", "Goal-based agents plan sequences of actions to reach goals.", "They have an objective they're working toward."),
        Q("Partial-order planning allows:", ["Steps to be ordered flexibly (not strictly sequential)", "Only sequential plans", "No backtracking", "Random ordering"], "Steps to be ordered flexibly (not strictly sequential)", "Only necessary orderings are enforced, allowing parallelism.", "Not all steps need a fixed sequence."),
    ];

    if (topicLower.includes('natural language') || topicLower.includes('nlp')) return [
        Q("Tokenization in NLP is:", ["Splitting text into individual words or tokens", "Encrypting text", "Translating text", "Compressing text"], "Splitting text into individual words or tokens", "Tokenization is the first step in processing text data.", "Breaking a sentence into its component pieces."),
        Q("Sentiment analysis determines:", ["The emotional tone of text (positive/negative)", "Grammar correctness", "Word count", "Translation accuracy"], "The emotional tone of text (positive/negative)", "It classifies text as positive, negative, or neutral.", "Is a review happy or unhappy?"),
        Q("A language model predicts:", ["The probability of the next word in a sequence", "Image labels", "Database queries", "Network traffic"], "The probability of the next word in a sequence", "Language models learn statistical patterns in text to predict continuations.", "Like autocomplete — what word comes next?"),
        Q("Named Entity Recognition (NER) identifies:", ["Proper nouns like names, places, organizations", "Verb tenses", "Sentence structure", "Spelling errors"], "Proper nouns like names, places, organizations", "NER tags entities in text like people, locations, dates.", "Finding the who, where, and when in text."),
    ];

    if (topicLower.includes('ethics') || topicLower.includes('safety')) return [
        Q("Algorithmic bias occurs when:", ["AI systems produce unfair outcomes for certain groups", "Algorithms run too slowly", "Code has syntax errors", "Models are too accurate"], "AI systems produce unfair outcomes for certain groups", "Bias in training data or design leads to discriminatory results.", "Think about fairness across different demographics."),
        Q("Explainability in AI means:", ["Understanding why a model made a specific decision", "Making AI faster", "Reducing model size", "Increasing accuracy"], "Understanding why a model made a specific decision", "Explainable AI (XAI) provides transparent reasoning for outputs.", "Can you explain WHY the AI said what it said?"),
        Q("The AI alignment problem asks:", ["How to ensure AI goals match human values", "How to make AI faster", "How to reduce AI costs", "How to train more data"], "How to ensure AI goals match human values", "Misaligned AI could pursue goals harmful to humans.", "Making sure AI wants what we want."),
    ];

    // --- MACHINE LEARNING ---
    if (topicLower.includes('ml fundamental') || topicLower.includes('ml basic')) return [
        Q("Overfitting occurs when a model:", ["Learns training data too well, including noise", "Is too simple", "Has too few parameters", "Generalizes perfectly"], "Learns training data too well, including noise", "An overfit model has high training accuracy but poor test accuracy.", "It memorizes rather than learns patterns."),
        Q("The bias-variance tradeoff means:", ["Reducing one often increases the other", "Both can be zero", "They are unrelated", "Higher bias is always better"], "Reducing one often increases the other", "Simple models have high bias; complex models have high variance.", "It's a balancing act between simplicity and flexibility."),
        Q("A training set is used to:", ["Teach the model patterns in data", "Evaluate final performance", "Deploy the model", "Visualize results"], "Teach the model patterns in data", "The training set is what the model learns from.", "Like a textbook the model studies from."),
        Q("Cross-validation helps prevent:", ["Overfitting by testing on multiple data splits", "Underfitting", "Data collection errors", "Feature engineering"], "Overfitting by testing on multiple data splits", "It rotates which data is used for training and testing.", "Testing on different subsets for more reliable evaluation."),
    ];

    if (topicLower.includes('supervised')) return [
        Q("Linear regression predicts:", ["A continuous numerical value", "A category", "Clusters", "Rules"], "A continuous numerical value", "It fits a line to predict continuous outcomes like price or temperature.", "Think about predicting a number, not a label."),
        Q("Logistic regression is used for:", ["Binary classification (yes/no)", "Regression", "Clustering", "Dimensionality reduction"], "Binary classification (yes/no)", "Despite its name, it classifies into two categories using a sigmoid.", "It outputs a probability between 0 and 1."),
        Q("Decision trees split data based on:", ["Feature values that best separate classes", "Random selection", "Alphabetical order", "Data size"], "Feature values that best separate classes", "Each node tests a feature to maximize information gain.", "Like playing 20 questions — each question narrows it down."),
        Q("An SVM finds:", ["The optimal hyperplane separating classes with maximum margin", "The average of all data", "Clusters in data", "Sequential patterns"], "The optimal hyperplane separating classes with maximum margin", "SVMs maximize the gap between the closest points of each class.", "Think about drawing the widest possible boundary."),
    ];

    if (topicLower.includes('unsupervised')) return [
        Q("K-means clustering requires you to specify:", ["The number of clusters (k)", "The labels", "The test set", "The learning rate"], "The number of clusters (k)", "You must choose k beforehand; the algorithm assigns points to k centroids.", "The 'K' in K-means represents a number you choose."),
        Q("PCA is used for:", ["Dimensionality reduction", "Classification", "Regression", "Data collection"], "Dimensionality reduction", "PCA finds the most important directions (components) in the data.", "Reducing many features to fewer while keeping variance."),
        Q("Unsupervised learning works with:", ["Unlabeled data", "Labeled data", "Both equally", "Neither"], "Unlabeled data", "There are no target labels — the algorithm finds structure on its own.", "No teacher telling it the right answers."),
    ];

    if (topicLower.includes('neural net')) return [
        Q("A perceptron is:", ["The simplest neural network unit", "A type of database", "A clustering algorithm", "A search technique"], "The simplest neural network unit", "A perceptron takes weighted inputs, sums them, and applies an activation.", "It's the basic building block of neural networks."),
        Q("Backpropagation is used to:", ["Update weights by propagating error backwards", "Forward-pass data", "Collect training data", "Visualize networks"], "Update weights by propagating error backwards", "It computes gradients of the loss function to adjust weights.", "Error flows backward through the network to fix weights."),
        Q("ReLU activation function outputs:", ["max(0, x)", "Between -1 and 1", "Between 0 and 1", "Always positive"], "max(0, x)", "ReLU returns 0 for negative inputs and x for positive inputs.", "It clips negatives to zero and keeps positives as-is."),
        Q("Deep learning means using:", ["Neural networks with many hidden layers", "Only one layer", "No layers", "Linear models"], "Neural networks with many hidden layers", "Depth refers to the number of hidden layers in the network.", "More layers = deeper network."),
    ];

    if (topicLower.includes('evaluation')) return [
        Q("Precision measures:", ["Proportion of positive predictions that were correct", "Total correct predictions", "Speed of the model", "Amount of data used"], "Proportion of positive predictions that were correct", "Precision = TP / (TP + FP). Of all predicted positives, how many were actually positive?", "Of everything you predicted as positive, how many actually were?"),
        Q("Recall (sensitivity) measures:", ["Proportion of actual positives correctly identified", "Speed of prediction", "Number of features used", "Model complexity"], "Proportion of actual positives correctly identified", "Recall = TP / (TP + FN). How many actual positives did you catch?", "Of all the real positives, how many did you find?"),
        Q("The F1-score is:", ["Harmonic mean of precision and recall", "Arithmetic mean of all metrics", "The accuracy squared", "The error rate"], "Harmonic mean of precision and recall", "F1 = 2 × (precision × recall) / (precision + recall), balancing both.", "It balances precision and recall into one number."),
        Q("An ROC curve plots:", ["True positive rate vs false positive rate", "Accuracy vs loss", "Precision vs recall", "Training time vs accuracy"], "True positive rate vs false positive rate", "ROC visualizes classifier performance across all thresholds.", "It shows the tradeoff between catching positives and false alarms."),
    ];

    if (topicLower.includes('reinforcement')) return [
        Q("In reinforcement learning, an agent learns by:", ["Receiving rewards or penalties for actions", "Reading labeled data", "Clustering data", "Feature extraction"], "Receiving rewards or penalties for actions", "The agent maximizes cumulative reward through trial and error.", "Like training a dog with treats and corrections."),
        Q("Q-learning estimates:", ["The value of taking an action in a given state", "The number of clusters", "Sentence probabilities", "Image features"], "The value of taking an action in a given state", "Q(s,a) estimates the expected future reward for action a in state s.", "Q stands for 'quality' of an action in a state."),
        Q("A Markov Decision Process (MDP) assumes:", ["Future states depend only on the current state, not history", "All past states matter equally", "Random outcomes only", "No rewards exist"], "Future states depend only on the current state, not history", "The Markov property: the future is independent of the past given the present.", "Only the present matters, not how you got here."),
    ];

    // --- WEB DEVELOPMENT ---
    if (topicLower.includes('html') || topicLower.includes('css')) return [
        Q("Which HTML tag is for the largest heading?", ["<h1>", "<h6>", "<header>", "<heading>"], "<h1>", "h1 is the largest, h6 is the smallest heading level.", "The lower the number, the bigger the heading."),
        Q("CSS Flexbox is used for:", ["One-dimensional layouts (row or column)", "3D animations", "Database queries", "Server-side rendering"], "One-dimensional layouts (row or column)", "Flexbox arranges items along a single axis.", "Think about arranging items in a line."),
        Q("What does 'responsive design' mean?", ["Layout adapts to different screen sizes", "Design never changes", "Only works on desktop", "Requires JavaScript"], "Layout adapts to different screen sizes", "Media queries and flexible layouts make sites work on all devices.", "How a website looks different on a phone vs. a desktop."),
        Q("The CSS 'position: absolute' positions an element relative to:", ["Its nearest positioned ancestor", "The viewport always", "Its sibling", "The document body always"], "Its nearest positioned ancestor", "Absolute positioning uses the nearest parent with position set.", "It looks for a parent that has position: relative/absolute/fixed."),
    ];

    if (topicLower.includes('javascript essential')) return [
        Q("What is a closure in JavaScript?", ["A function that retains access to its outer scope's variables", "A CSS property", "An HTML element", "A server framework"], "A function that retains access to its outer scope's variables", "Closures 'close over' variables from their creation environment.", "A function remembering variables from where it was created."),
        Q("async/await is used for:", ["Handling asynchronous operations cleanly", "Styling elements", "Creating HTML", "Database design"], "Handling asynchronous operations cleanly", "async/await makes promises easier to read and write.", "It makes asynchronous code look synchronous."),
        Q("The spread operator (...) can:", ["Expand an array into individual elements", "Delete variables", "Create loops", "Define classes"], "Expand an array into individual elements", "e.g., [...arr] creates a copy, func(...args) passes elements as arguments.", "Three dots that 'spread' things out."),
        Q("'=== ' in JavaScript checks:", ["Value AND type equality", "Value only", "Type only", "Assignment"], "Value AND type equality", "Strict equality checks both value and type (no type coercion).", "It's stricter than == which only checks value."),
    ];

    if (topicLower.includes('react')) return [
        Q("React components are written using:", ["JSX (JavaScript XML)", "Pure HTML", "SQL", "Python"], "JSX (JavaScript XML)", "JSX lets you write HTML-like syntax in JavaScript.", "It looks like HTML but lives inside JavaScript."),
        Q("useState hook is used for:", ["Managing local component state", "Routing", "API calls", "Styling"], "Managing local component state", "useState returns a state variable and a setter function.", "It stores and updates data within a component."),
        Q("The Virtual DOM in React:", ["Minimizes actual DOM updates for performance", "Replaces the real DOM entirely", "Is visible to users", "Only works in Node.js"], "Minimizes actual DOM updates for performance", "React compares virtual DOM changes and updates only what's different.", "It's a lightweight copy used for efficient updates."),
        Q("Props in React are:", ["Data passed from parent to child components", "Internal state", "CSS styles", "API endpoints"], "Data passed from parent to child components", "Props are read-only and flow downward in the component tree.", "Like giving instructions from a parent to a child."),
    ];

    if (topicLower.includes('rest') || topicLower.includes('http')) return [
        Q("The HTTP status code 404 means:", ["Not Found", "Server Error", "Success", "Redirect"], "Not Found", "404 indicates the requested resource doesn't exist.", "The most famous error page on the internet."),
        Q("A GET request is used to:", ["Retrieve data from a server", "Create new data", "Delete data", "Update data"], "Retrieve data from a server", "GET requests are read-only and should not modify server state.", "Think about 'getting' or fetching information."),
        Q("REST APIs are:", ["Stateless — each request contains all information needed", "Stateful — server remembers sessions", "Only for databases", "Only for mobile apps"], "Stateless — each request contains all information needed", "Each REST request is independent and self-contained.", "The server doesn't remember previous requests."),
        Q("JSON stands for:", ["JavaScript Object Notation", "Java Standard Object Naming", "JSON Script Output Network", "Just Simple Object Names"], "JavaScript Object Notation", "JSON is a lightweight data format using key-value pairs.", "It uses curly braces {} and key-value pairs."),
    ];

    if (topicLower.includes('node') || topicLower.includes('backend')) return [
        Q("Node.js runs JavaScript on:", ["The server (outside the browser)", "Only in browsers", "Only on mobile", "Only on Windows"], "The server (outside the browser)", "Node.js uses Chrome's V8 engine to run JS server-side.", "JavaScript breaks free from the browser."),
        Q("Express.js is a:", ["Web framework for Node.js", "Database", "CSS framework", "Testing library"], "Web framework for Node.js", "Express simplifies building APIs and web servers in Node.", "The most popular Node.js web framework."),
        Q("Middleware in Express:", ["Processes requests before they reach route handlers", "Creates databases", "Renders HTML", "Compiles TypeScript"], "Processes requests before they reach route handlers", "Middleware functions have access to req, res, and next().", "Like checkpoints a request passes through."),
    ];

    if (topicLower.includes('deployment') || topicLower.includes('devops')) return [
        Q("CI/CD stands for:", ["Continuous Integration / Continuous Deployment", "Code Integration / Code Delivery", "Central Intelligence / Central Data", "Custom Implementation / Custom Design"], "Continuous Integration / Continuous Deployment", "CI/CD automates building, testing, and deploying code.", "Automate the entire pipeline from code to production."),
        Q("Docker containers provide:", ["Isolated, reproducible environments for applications", "Only database storage", "CSS frameworks", "Code editors"], "Isolated, reproducible environments for applications", "Containers package code with dependencies for consistency.", "Like shipping containers — everything needed is inside."),
        Q("Environment variables are used to:", ["Store configuration that varies between environments", "Write CSS", "Create HTML", "Design databases"], "Store configuration that varies between environments", "API keys, database URLs, and secrets go in env vars.", "Different values for production vs development."),
    ];

    // --- DATA PROCESSING ---
    if (topicLower.includes('data collection')) return [
        Q("Web scraping is:", ["Automatically extracting data from websites", "Manually typing data", "A database query", "A visualization tool"], "Automatically extracting data from websites", "Programs parse HTML to collect structured data from web pages.", "Having a bot read websites and save the information."),
        Q("CSV stands for:", ["Comma-Separated Values", "Computer System Variables", "Central Server Validation", "Coded Sequential Values"], "Comma-Separated Values", "CSV is a simple text format where values are separated by commas.", "The delimiter between values is a comma."),
        Q("An API provides:", ["A structured way to access data from external services", "A way to style web pages", "A database backup", "A computer's hardware specifications"], "A structured way to access data from external services", "APIs return data in structured formats like JSON.", "A door through which you request and receive data."),
    ];

    if (topicLower.includes('data cleaning')) return [
        Q("Imputation for missing values means:", ["Filling in missing data with estimated values", "Deleting the entire dataset", "Ignoring missing data", "Converting data types"], "Filling in missing data with estimated values", "Common methods: mean, median, mode, or model-based imputation.", "Substituting a reasonable guess for missing entries."),
        Q("An outlier is:", ["A data point significantly different from others", "A missing value", "A duplicate record", "A column header"], "A data point significantly different from others", "Outliers can skew analysis and may need investigation.", "That one value that's way off from the rest."),
        Q("Removing duplicates is important because:", ["They inflate counts and skew analysis", "They improve accuracy", "They increase dataset size beneficially", "They are helpful for training"], "They inflate counts and skew analysis", "Duplicate records can bias statistics and model training.", "Having the same data twice makes it unfairly weighted."),
        Q("Data inconsistency means:", ["Same concept represented differently (e.g., USA vs United States)", "Missing values", "Too much data", "Fast processing"], "Same concept represented differently (e.g., USA vs United States)", "Standardizing formats ensures reliable analysis.", "When the same thing is written different ways."),
    ];

    if (topicLower.includes('data transformation')) return [
        Q("Normalization scales data to:", ["A range of 0 to 1", "A range of -100 to 100", "Negative values only", "Categorical values"], "A range of 0 to 1", "Min-max normalization: (x - min) / (max - min).", "Shrinking values to fit between zero and one."),
        Q("One-hot encoding converts:", ["Categorical data into binary columns", "Numbers into text", "Images into text", "Audio into video"], "Categorical data into binary columns", "Each category becomes a separate column with 0/1 values.", "Red → [1,0,0], Green → [0,1,0], Blue → [0,0,1]."),
        Q("Standardization (Z-score) transforms data to have:", ["Mean = 0 and standard deviation = 1", "All positive values", "Range 0 to 1", "Integer values only"], "Mean = 0 and standard deviation = 1", "Z = (x - μ) / σ centers data with unit variance.", "Centering around zero with a standard spread."),
        Q("Log transformation is useful for:", ["Reducing right-skewed data", "Making data negative", "Increasing outliers", "Removing all zeros"], "Reducing right-skewed data", "Log compresses large values, making skewed distributions more normal.", "It squashes big numbers and spreads out small ones."),
    ];

    if (topicLower.includes('exploratory') || topicLower.includes('eda')) return [
        Q("A histogram shows:", ["Distribution of a single variable", "Relationship between two variables", "Data over time", "Proportions of a whole"], "Distribution of a single variable", "Histograms bin continuous data to show frequency distribution.", "Bars showing how often values fall in each range."),
        Q("Correlation measures:", ["The strength and direction of relationship between two variables", "Causation", "Data size", "Processing speed"], "The strength and direction of relationship between two variables", "Values range from -1 (negative) to +1 (positive).", "How strongly two things move together."),
        Q("The mean can be misleading when:", ["Data has extreme outliers", "Data is normally distributed", "All values are equal", "Sample size is large"], "Data has extreme outliers", "Outliers pull the mean toward extreme values.", "One billionaire walks into a bar and the 'average' income skyrockets."),
        Q("A box plot shows:", ["Median, quartiles, and potential outliers", "Only the mean", "Colors of data", "Text data"], "Median, quartiles, and potential outliers", "The box shows IQR, whiskers show range, dots show outliers.", "The five-number summary in a visual."),
    ];

    if (topicLower.includes('feature engineering')) return [
        Q("Feature selection aims to:", ["Keep only the most relevant features", "Add more features", "Delete the dataset", "Change the target variable"], "Keep only the most relevant features", "Removing irrelevant features improves model performance and reduces complexity.", "Choosing which columns actually matter."),
        Q("Polynomial features create:", ["New features by raising existing ones to powers", "Graphs", "New datasets", "Random features"], "New features by raising existing ones to powers", "e.g., from x, create x², x³ to capture non-linear patterns.", "Multiplying features by themselves to capture curves."),
        Q("Dimensionality reduction helps by:", ["Reducing the number of features while preserving information", "Adding more data", "Increasing complexity", "Slowing down training"], "Reducing the number of features while preserving information", "Techniques like PCA compress many features into fewer important ones.", "Fewer columns, same essential information."),
    ];

    if (topicLower.includes('postprocessing') || topicLower.includes('reporting')) return [
        Q("A confusion matrix shows:", ["True/false positives and negatives for a classifier", "CPU performance", "Network traffic", "File sizes"], "True/false positives and negatives for a classifier", "It compares predictions against actual labels in a 2x2 grid.", "A table showing what the model got right and wrong."),
        Q("Data visualization best practices include:", ["Choosing the right chart type for your data", "Using as many colors as possible", "Making charts as complex as possible", "Ignoring labels"], "Choosing the right chart type for your data", "The right visualization highlights patterns and insights clearly.", "Match the chart to what you're trying to show."),
        Q("A dashboard is:", ["An interactive display of key metrics and visualizations", "A database table", "A Python library", "A machine learning model"], "An interactive display of key metrics and visualizations", "Dashboards provide at-a-glance summaries for decision-making.", "Think about a car dashboard but for data."),
    ];

    // Generic fallback
    return [
        Q(`Which statement best describes ${topic}?`,
            ["It is a fundamental principle studied systematically", "It has no practical applications", "It was discovered in the 21st century", "It only applies in theory"],
            "It is a fundamental principle studied systematically",
            `${topic} encompasses fundamental principles studied and applied systematically.`,
            "Think about the foundational nature of this subject."),
        Q(`What is a key goal of studying ${topic}?`,
            ["To understand and apply its core principles", "To memorize dates only", "To avoid practical work", "To make things more complicated"],
            "To understand and apply its core principles",
            `Studying ${topic} aims to build understanding that can be applied in real situations.`,
            "Think about why we study any subject."),
    ];
}
