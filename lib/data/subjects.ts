// ============================================================
// Subject & Topic Data
// ============================================================
// Pre-defined subject content for the tutor system.
// In production, this would come from a database.

import { Subject, Topic } from '../types';

export const SUBJECTS: Subject[] = [
    {
        id: 'math',
        name: 'Mathematics',
        description: 'Fundamental mathematics concepts from algebra to calculus',
        icon: '📐',
        color: '#6366f1',
        topics: [
            {
                id: 'math-algebra-basics',
                name: 'Algebra Basics',
                description: 'Variables, expressions, and simple equations',
                prerequisites: [],
            },
            {
                id: 'math-linear-equations',
                name: 'Linear Equations',
                description: 'Solving and graphing linear equations and inequalities',
                prerequisites: ['math-algebra-basics'],
            },
            {
                id: 'math-quadratics',
                name: 'Quadratic Equations',
                description: 'Factoring, quadratic formula, and parabolas',
                prerequisites: ['math-linear-equations'],
            },
            {
                id: 'math-functions',
                name: 'Functions',
                description: 'Domain, range, composition, and types of functions',
                prerequisites: ['math-algebra-basics'],
            },
            {
                id: 'math-trigonometry',
                name: 'Trigonometry',
                description: 'Sine, cosine, tangent, and trigonometric identities',
                prerequisites: ['math-functions'],
            },
            {
                id: 'math-probability',
                name: 'Probability',
                description: 'Basic probability, combinations, and permutations',
                prerequisites: ['math-algebra-basics'],
            },
        ],
    },
    {
        id: 'science',
        name: 'Science',
        description: 'Physics, Chemistry, and Biology fundamentals',
        icon: '🔬',
        color: '#10b981',
        topics: [
            {
                id: 'sci-newtons-laws',
                name: "Newton's Laws of Motion",
                description: 'Three laws of motion, force, mass, and acceleration',
                prerequisites: [],
            },
            {
                id: 'sci-energy',
                name: 'Energy & Work',
                description: 'Kinetic energy, potential energy, conservation of energy',
                prerequisites: ['sci-newtons-laws'],
            },
            {
                id: 'sci-atoms',
                name: 'Atomic Structure',
                description: 'Protons, neutrons, electrons, atomic number, and mass',
                prerequisites: [],
            },
            {
                id: 'sci-periodic-table',
                name: 'Periodic Table',
                description: 'Element groups, periods, trends, and properties',
                prerequisites: ['sci-atoms'],
            },
            {
                id: 'sci-cells',
                name: 'Cell Biology',
                description: 'Cell structure, organelles, and cellular processes',
                prerequisites: [],
            },
            {
                id: 'sci-genetics',
                name: 'Genetics',
                description: 'DNA, genes, heredity, and Punnett squares',
                prerequisites: ['sci-cells'],
            },
        ],
    },
    {
        id: 'cs',
        name: 'Computer Science',
        description: 'Programming fundamentals and computer science theory',
        icon: '💻',
        color: '#f59e0b',
        topics: [
            {
                id: 'cs-variables',
                name: 'Variables & Data Types',
                description: 'Primitive types, variables, type casting, and constants',
                prerequisites: [],
            },
            {
                id: 'cs-control-flow',
                name: 'Control Flow',
                description: 'If/else statements, loops, and switch cases',
                prerequisites: ['cs-variables'],
            },
            {
                id: 'cs-functions',
                name: 'Functions & Methods',
                description: 'Function declaration, parameters, return values, scope',
                prerequisites: ['cs-control-flow'],
            },
            {
                id: 'cs-arrays',
                name: 'Arrays & Lists',
                description: 'Array operations, iteration, searching, and sorting',
                prerequisites: ['cs-control-flow'],
            },
            {
                id: 'cs-oop',
                name: 'Object-Oriented Programming',
                description: 'Classes, objects, inheritance, polymorphism, encapsulation',
                prerequisites: ['cs-functions'],
            },
            {
                id: 'cs-algorithms',
                name: 'Basic Algorithms',
                description: 'Big-O notation, sorting algorithms, binary search',
                prerequisites: ['cs-arrays', 'cs-functions'],
            },
        ],
    },
    {
        id: 'history',
        name: 'History',
        description: 'World history from ancient civilizations to modern era',
        icon: '📜',
        color: '#ef4444',
        topics: [
            {
                id: 'hist-ancient-civ',
                name: 'Ancient Civilizations',
                description: 'Mesopotamia, Egypt, Greece, and Rome',
                prerequisites: [],
            },
            {
                id: 'hist-medieval',
                name: 'Medieval Period',
                description: 'Feudalism, Crusades, and the Black Death',
                prerequisites: ['hist-ancient-civ'],
            },
            {
                id: 'hist-renaissance',
                name: 'Renaissance & Reformation',
                description: 'Cultural rebirth, scientific revolution, Protestant reformation',
                prerequisites: ['hist-medieval'],
            },
            {
                id: 'hist-revolutions',
                name: 'Age of Revolutions',
                description: 'American, French, and Industrial revolutions',
                prerequisites: ['hist-renaissance'],
            },
            {
                id: 'hist-world-wars',
                name: 'World Wars',
                description: 'WWI, WWII, causes, major events, and aftermath',
                prerequisites: ['hist-revolutions'],
            },
            {
                id: 'hist-modern',
                name: 'Modern World',
                description: 'Cold War, decolonization, globalization, and technology',
                prerequisites: ['hist-world-wars'],
            },
        ],
    },
    {
        id: 'ai',
        name: 'Artificial Intelligence',
        description: 'Core concepts of AI from search algorithms to expert systems',
        icon: '🤖',
        color: '#8b5cf6',
        topics: [
            {
                id: 'ai-intro',
                name: 'Introduction to AI',
                description: 'History of AI, Turing test, types of AI (narrow vs general)',
                prerequisites: [],
            },
            {
                id: 'ai-search',
                name: 'Search Algorithms',
                description: 'BFS, DFS, A*, heuristic search, and adversarial search',
                prerequisites: ['ai-intro'],
            },
            {
                id: 'ai-knowledge',
                name: 'Knowledge Representation',
                description: 'Propositional logic, first-order logic, ontologies, semantic networks',
                prerequisites: ['ai-intro'],
            },
            {
                id: 'ai-planning',
                name: 'AI Planning',
                description: 'Goal-based agents, STRIPS, partial-order planning',
                prerequisites: ['ai-search', 'ai-knowledge'],
            },
            {
                id: 'ai-nlp',
                name: 'Natural Language Processing',
                description: 'Tokenization, parsing, sentiment analysis, language models',
                prerequisites: ['ai-knowledge'],
            },
            {
                id: 'ai-ethics',
                name: 'AI Ethics & Safety',
                description: 'Bias in AI, fairness, explainability, alignment problem',
                prerequisites: ['ai-intro'],
            },
        ],
    },
    {
        id: 'ml',
        name: 'Machine Learning',
        description: 'Supervised, unsupervised, and reinforcement learning techniques',
        icon: '🧠',
        color: '#ec4899',
        topics: [
            {
                id: 'ml-basics',
                name: 'ML Fundamentals',
                description: 'Training vs testing, overfitting, underfitting, bias-variance tradeoff',
                prerequisites: [],
            },
            {
                id: 'ml-supervised',
                name: 'Supervised Learning',
                description: 'Linear regression, logistic regression, decision trees, SVMs',
                prerequisites: ['ml-basics'],
            },
            {
                id: 'ml-unsupervised',
                name: 'Unsupervised Learning',
                description: 'K-means clustering, hierarchical clustering, PCA, association rules',
                prerequisites: ['ml-basics'],
            },
            {
                id: 'ml-neural-nets',
                name: 'Neural Networks',
                description: 'Perceptrons, backpropagation, activation functions, deep learning basics',
                prerequisites: ['ml-supervised'],
            },
            {
                id: 'ml-evaluation',
                name: 'Model Evaluation',
                description: 'Accuracy, precision, recall, F1-score, ROC curves, cross-validation',
                prerequisites: ['ml-supervised'],
            },
            {
                id: 'ml-reinforcement',
                name: 'Reinforcement Learning',
                description: 'Markov decision processes, Q-learning, policy gradients, rewards',
                prerequisites: ['ml-basics'],
            },
        ],
    },
    {
        id: 'webdev',
        name: 'Web Development',
        description: 'Frontend, backend, and full-stack web development',
        icon: '🌐',
        color: '#0ea5e9',
        topics: [
            {
                id: 'web-html-css',
                name: 'HTML & CSS',
                description: 'Semantic HTML, CSS selectors, flexbox, grid, responsive design',
                prerequisites: [],
            },
            {
                id: 'web-javascript',
                name: 'JavaScript Essentials',
                description: 'ES6+, DOM manipulation, async/await, closures, prototypes',
                prerequisites: ['web-html-css'],
            },
            {
                id: 'web-react',
                name: 'React & Components',
                description: 'JSX, state, props, hooks, component lifecycle, virtual DOM',
                prerequisites: ['web-javascript'],
            },
            {
                id: 'web-apis',
                name: 'REST APIs & HTTP',
                description: 'HTTP methods, status codes, REST principles, JSON, fetch API',
                prerequisites: ['web-javascript'],
            },
            {
                id: 'web-node',
                name: 'Node.js & Backend',
                description: 'Express.js, middleware, routing, authentication, databases',
                prerequisites: ['web-javascript'],
            },
            {
                id: 'web-deployment',
                name: 'Deployment & DevOps',
                description: 'CI/CD, Docker basics, Vercel/Netlify, environment variables',
                prerequisites: ['web-node', 'web-react'],
            },
        ],
    },
    {
        id: 'data',
        name: 'Data Processing',
        description: 'Data preprocessing, cleaning, transformation, and postprocessing',
        icon: '📊',
        color: '#14b8a6',
        topics: [
            {
                id: 'data-collection',
                name: 'Data Collection',
                description: 'Data sources, web scraping, APIs, surveys, and data formats (CSV, JSON)',
                prerequisites: [],
            },
            {
                id: 'data-cleaning',
                name: 'Data Cleaning',
                description: 'Missing values, outliers, duplicates, inconsistencies, imputation',
                prerequisites: ['data-collection'],
            },
            {
                id: 'data-transformation',
                name: 'Data Transformation',
                description: 'Normalization, standardization, encoding categorical data, feature scaling',
                prerequisites: ['data-cleaning'],
            },
            {
                id: 'data-eda',
                name: 'Exploratory Data Analysis',
                description: 'Descriptive statistics, distributions, correlations, visualization',
                prerequisites: ['data-cleaning'],
            },
            {
                id: 'data-feature-eng',
                name: 'Feature Engineering',
                description: 'Feature selection, extraction, polynomial features, dimensionality reduction',
                prerequisites: ['data-transformation'],
            },
            {
                id: 'data-postprocessing',
                name: 'Postprocessing & Reporting',
                description: 'Result interpretation, visualization, model output formatting, dashboards',
                prerequisites: ['data-eda', 'data-feature-eng'],
            },
        ],
    },
];

/**
 * Get all topics across all subjects as a flat array.
 */
export function getAllTopics(): Topic[] {
    return SUBJECTS.flatMap(s => s.topics);
}

/**
 * Find topic by ID.
 */
export function getTopicById(id: string): Topic | undefined {
    return getAllTopics().find(t => t.id === id);
}

/**
 * Find subject by topic ID.
 */
export function getSubjectByTopicId(topicId: string): Subject | undefined {
    return SUBJECTS.find(s => s.topics.some(t => t.id === topicId));
}
