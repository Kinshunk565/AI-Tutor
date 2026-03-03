'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  StudentProfile,
  SessionState,
  Question,
  ResponseRecord,
  WeakTopicReport,
  LearningPathStep,
  DifficultyResult,
} from '../lib/types';
import { SUBJECTS, getAllTopics, getTopicById, getSubjectByTopicId } from '../lib/data/subjects';
import { processResponse, computeOverallAbility, createInitialMastery, predictPerformance } from '../lib/engine/knowledgeTracing';
import { calibrateDifficulty } from '../lib/engine/difficultyCalibrator';
import { detectWeakTopics, generateLearningPath } from '../lib/engine/patternDetector';
import { generateQuestion, generateFeedback } from '../lib/api/questionGenerator';
import { getProfile, saveProfile, clearSession, syncProfileToFirestore, loadProfileFromFirestore } from '../lib/db';
import { useAuth } from '../lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';

type View = 'dashboard' | 'quiz' | 'path' | 'analytics';

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [session, setSession] = useState<SessionState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [weakTopics, setWeakTopics] = useState<WeakTopicReport[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPathStep[]>([]);
  const [difficulty, setDifficulty] = useState<DifficultyResult | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Initialize — load from Firestore if available, else localStorage
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const topics = getAllTopics();
      const topicIds = topics.map(t => t.id);
      // Try loading from Firestore first
      let p = await loadProfileFromFirestore(user.uid);
      if (p) {
        // Ensure all topics exist
        let changed = false;
        for (const topicId of topicIds) {
          if (!p.masteryStates[topicId]) {
            p.masteryStates[topicId] = createInitialMastery(topicId);
            changed = true;
          }
        }
        if (changed) {
          saveProfile(p);
          syncProfileToFirestore(user.uid, p);
        }
      } else {
        p = getProfile(topicIds);
      }
      p.name = user.displayName || 'Student';
      setProfile(p);
      saveProfile(p);
      setWeakTopics(detectWeakTopics(p, topics));
      setLearningPath(generateLearningPath(p, topics));
    };
    init();
  }, [user]);

  const updateAnalytics = useCallback((p: StudentProfile) => {
    const topics = getAllTopics();
    setWeakTopics(detectWeakTopics(p, topics));
    setLearningPath(generateLearningPath(p, topics));
  }, []);

  // Start a quiz session
  const startQuiz = async (topicId: string) => {
    if (!profile) return;

    const topic = getTopicById(topicId);
    if (!topic) return;

    const masteryState = profile.masteryStates[topicId] || createInitialMastery(topicId);
    const diff = calibrateDifficulty(masteryState);
    setDifficulty(diff);

    const newSession: SessionState = {
      sessionId: `session_${Date.now()}`,
      studentId: profile.id,
      startedAt: Date.now(),
      currentTopicId: topicId,
      questionsAnswered: 0,
      correctInSession: 0,
      currentDifficulty: diff.recommendedDifficulty,
      currentQuestion: null,
      sessionHistory: [],
      isComplete: false,
    };

    setSession(newSession);
    setSessionComplete(false);
    setPreviousQuestions([]);
    setView('quiz');

    await loadNextQuestion(topicId, diff, []);
  };

  // Load next question
  const loadNextQuestion = async (
    topicId: string,
    diff: DifficultyResult,
    prevQs: string[]
  ) => {
    setIsLoading(true);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setFeedback('');
    setShowHint(false);

    const topic = getTopicById(topicId);
    if (!topic) return;

    try {
      const question = await generateQuestion(topic, diff, prevQs);
      setCurrentQuestion(question);
    } catch (error) {
      console.error('Failed to load question:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit answer
  const submitAnswer = async (answer: string) => {
    if (!currentQuestion || !session || !profile || isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    const isCorrect = answer === currentQuestion.correctAnswer;

    // Record response
    const response: ResponseRecord = {
      questionId: currentQuestion.id,
      topicId: session.currentTopicId,
      isCorrect,
      difficulty: currentQuestion.difficulty,
      responseTimeMs: Date.now() - session.startedAt,
      timestamp: Date.now(),
    };

    // Update mastery state
    const currentMastery = profile.masteryStates[session.currentTopicId] || createInitialMastery(session.currentTopicId);
    const updatedMastery = processResponse(currentMastery, response);

    // Update profile
    const updatedProfile: StudentProfile = {
      ...profile,
      masteryStates: {
        ...profile.masteryStates,
        [session.currentTopicId]: updatedMastery,
      },
      overallAbility: computeOverallAbility({
        ...profile,
        masteryStates: {
          ...profile.masteryStates,
          [session.currentTopicId]: updatedMastery,
        },
      }),
    };

    setProfile(updatedProfile);
    saveProfile(updatedProfile);
    if (user) syncProfileToFirestore(user.uid, updatedProfile);

    // Update session
    const updatedSession: SessionState = {
      ...session,
      questionsAnswered: session.questionsAnswered + 1,
      correctInSession: session.correctInSession + (isCorrect ? 1 : 0),
      sessionHistory: [...session.sessionHistory, response],
    };
    setSession(updatedSession);

    // Recalibrate difficulty
    const newDiff = calibrateDifficulty(updatedMastery);
    setDifficulty(newDiff);

    // Track previous questions
    setPreviousQuestions(prev => [...prev, currentQuestion.questionText]);

    // Generate feedback
    try {
      const fb = await generateFeedback(currentQuestion, answer, isCorrect);
      setFeedback(fb);
    } catch {
      setFeedback(isCorrect ? 'Correct!' : `The correct answer is: ${currentQuestion.correctAnswer}`);
    }
  };

  // Next question or complete session
  const handleNext = async () => {
    if (!session || !profile) return;

    const QUESTIONS_PER_SESSION = 8;

    if (session.questionsAnswered >= QUESTIONS_PER_SESSION) {
      setSessionComplete(true);
      updateAnalytics(profile);
      return;
    }

    const masteryState = profile.masteryStates[session.currentTopicId] || createInitialMastery(session.currentTopicId);
    const diff = calibrateDifficulty(masteryState);
    setDifficulty(diff);

    await loadNextQuestion(session.currentTopicId, diff, previousQuestions);
  };

  // End session
  const endSession = () => {
    clearSession();
    setSession(null);
    setCurrentQuestion(null);
    setSessionComplete(false);
    setView('dashboard');
    if (profile) {
      updateAnalytics(profile);
    }
  };

  // Reset progress
  const resetProgress = () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (authLoading || !user || !profile) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Initializing NeuralTutor...</div>
      </div>
    );
  }

  const overallMastery = Math.round(profile.overallAbility * 100);
  const totalAttempts = Object.values(profile.masteryStates).reduce((sum, s) => sum + s.attempts, 0);
  const totalCorrect = Object.values(profile.masteryStates).reduce((sum, s) => sum + s.correctCount, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🧠</div>
          <h1>NeuralTutor</h1>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setView('dashboard'); endSession(); }}
            id="nav-dashboard"
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${view === 'path' ? 'active' : ''}`}
            onClick={() => setView('path')}
            id="nav-path"
          >
            Learning Path
          </button>
          <button
            className={`nav-btn ${view === 'analytics' ? 'active' : ''}`}
            onClick={() => setView('analytics')}
            id="nav-analytics"
          >
            Analytics
          </button>
        </nav>
        <div className="user-header-section">
          <span className="user-greeting">👋 {user.displayName || user.email}</span>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <>
          {/* Stats Row */}
          <div className="dashboard-grid">
            <div className="glass-card stat-card" style={{ '--stat-color': '#6366f1' } as React.CSSProperties}>
              <div className="stat-label">Overall Mastery</div>
              <div className="stat-value">{overallMastery}%</div>
              <div className="stat-detail">across {Object.keys(profile.masteryStates).length} topics</div>
            </div>
            <div className="glass-card stat-card" style={{ '--stat-color': '#10b981' } as React.CSSProperties}>
              <div className="stat-label">Accuracy</div>
              <div className="stat-value">{accuracy}%</div>
              <div className="stat-detail">{totalCorrect} / {totalAttempts} correct</div>
            </div>
            <div className="glass-card stat-card" style={{ '--stat-color': '#06b6d4' } as React.CSSProperties}>
              <div className="stat-label">Questions Answered</div>
              <div className="stat-value">{totalAttempts}</div>
              <div className="stat-detail">Keep practicing!</div>
            </div>
            <div className="glass-card stat-card" style={{ '--stat-color': '#f59e0b' } as React.CSSProperties}>
              <div className="stat-label">Weak Areas</div>
              <div className="stat-value">{weakTopics.filter(w => w.priority === 'critical' || w.priority === 'high').length}</div>
              <div className="stat-detail">topics need attention</div>
            </div>
          </div>

          {/* Weak Topics Alert */}
          {weakTopics.length > 0 && totalAttempts > 5 && (
            <div className="glass-card" style={{ marginBottom: 24, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div className="section-header">
                <div>
                  <div className="section-title">⚡ Focus Areas</div>
                  <div className="section-subtitle">Topics where you need the most improvement</div>
                </div>
              </div>
              {weakTopics.slice(0, 4).map(wt => (
                <div key={wt.topicId} className="weak-topic-item">
                  <span className={`priority-badge priority-${wt.priority}`}>{wt.priority}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{wt.topicName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Mastery: {Math.round(wt.mastery * 100)}% · Failure rate: {Math.round(wt.failureRate * 100)}%
                    </div>
                  </div>
                  <span className={`trend-badge trend-${wt.recentTrend}`}>
                    {wt.recentTrend === 'improving' ? '📈' : wt.recentTrend === 'declining' ? '📉' : '➡️'} {wt.recentTrend}
                  </span>
                  <button className="btn btn-sm btn-primary" onClick={() => startQuiz(wt.topicId)}>
                    Practice
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Subject Cards */}
          <div className="section-header">
            <div>
              <div className="section-title">📚 Subjects</div>
              <div className="section-subtitle">Select a topic to start an adaptive quiz session</div>
            </div>
          </div>

          <div className="subject-grid">
            {SUBJECTS.map(subject => (
              <div
                key={subject.id}
                className="glass-card subject-card"
                style={{ '--subject-color': subject.color } as React.CSSProperties}
              >
                <div className="subject-header">
                  <div className="subject-icon">{subject.icon}</div>
                  <div>
                    <div className="subject-name">{subject.name}</div>
                    <div className="subject-desc">{subject.description}</div>
                  </div>
                </div>

                <div className="topic-progress-list">
                  {subject.topics.map(topic => {
                    const mastery = profile.masteryStates[topic.id]?.probability ?? 0;
                    return (
                      <div
                        key={topic.id}
                        className="topic-progress-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => startQuiz(topic.id)}
                      >
                        <span className="topic-name">{topic.name}</span>
                        <div className="progress-bar-container">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.round(mastery * 100)}%`,
                              background: `linear-gradient(90deg, ${subject.color}, ${subject.color}88)`,
                            }}
                          />
                        </div>
                        <span className="progress-value">{Math.round(mastery * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Reset button */}
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <button className="btn btn-sm btn-secondary" onClick={resetProgress} id="reset-btn">
              🗑️ Reset All Progress
            </button>
          </div>
        </>
      )}

      {/* Quiz View */}
      {view === 'quiz' && session && !sessionComplete && (
        <div className="quiz-container">
          {/* Quiz Header */}
          <div className="quiz-header">
            <div>
              <span className="quiz-topic-badge">
                {getSubjectByTopicId(session.currentTopicId)?.icon}{' '}
                {getTopicById(session.currentTopicId)?.name}
              </span>
            </div>
            <div className="quiz-stats">
              <div className="quiz-stat">
                <div className="quiz-stat-value" style={{ color: 'var(--color-green)' }}>
                  {session.correctInSession}
                </div>
                <div className="quiz-stat-label">Correct</div>
              </div>
              <div className="quiz-stat">
                <div className="quiz-stat-value">
                  {session.questionsAnswered}
                </div>
                <div className="quiz-stat-label">/ 8 Done</div>
              </div>
              <div className="quiz-stat">
                <div className="quiz-stat-value" style={{ color: 'var(--color-accent-light)' }}>
                  {Math.round((profile.masteryStates[session.currentTopicId]?.probability ?? 0) * 100)}%
                </div>
                <div className="quiz-stat-label">Mastery</div>
              </div>
            </div>
          </div>

          {/* Difficulty Indicator */}
          {difficulty && (
            <div className="difficulty-indicator">
              <span className="difficulty-label">Difficulty:</span>
              <div className="difficulty-dots">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className={`difficulty-dot ${i < difficulty.recommendedDifficulty ? 'active' : ''} ${i >= 7 ? 'extreme' : i >= 5 ? 'high' : ''
                      }`}
                  />
                ))}
              </div>
              <span className="difficulty-label">{difficulty.recommendedDifficulty}/10 ({difficulty.zone})</span>
            </div>
          )}

          {/* Question */}
          {isLoading ? (
            <div className="loading-container">
              <div className="spinner" />
              <div className="loading-text">Generating your next question...</div>
            </div>
          ) : currentQuestion ? (
            <>
              <div className="glass-card question-card">
                <div className="question-text">{currentQuestion.questionText}</div>

                <div className="options-list">
                  {currentQuestion.options?.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    let className = 'option-btn';
                    if (isAnswered) {
                      if (option === currentQuestion.correctAnswer) className += ' correct';
                      else if (option === selectedAnswer) className += ' incorrect';
                    } else if (option === selectedAnswer) {
                      className += ' selected';
                    }

                    return (
                      <button
                        key={idx}
                        className={className}
                        onClick={() => submitAnswer(option)}
                        disabled={isAnswered}
                        id={`option-${letter}`}
                      >
                        <span className="option-letter">{letter}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Hint */}
                {!isAnswered && currentQuestion.hint && (
                  <div style={{ marginTop: 16 }}>
                    {!showHint ? (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setShowHint(true)}
                        id="hint-btn"
                      >
                        💡 Show Hint
                      </button>
                    ) : (
                      <div className="hint-section">
                        <div className="hint-label">💡 Hint</div>
                        <div className="hint-text">{currentQuestion.hint}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Feedback */}
              {isAnswered && feedback && (
                <div
                  className={`feedback-section ${selectedAnswer === currentQuestion.correctAnswer
                    ? 'feedback-correct'
                    : 'feedback-incorrect'
                    }`}
                >
                  <div className="feedback-header">
                    {selectedAnswer === currentQuestion.correctAnswer ? (
                      <span>✅ Correct!</span>
                    ) : (
                      <span>❌ Not quite</span>
                    )}

                    {/* Mastery change indicator */}
                    {(() => {
                      const prevMastery = (profile.masteryStates[session.currentTopicId]?.probability ?? 0);
                      // Simplified display — show current mastery
                      return (
                        <span className={`mastery-change ${selectedAnswer === currentQuestion.correctAnswer ? 'positive' : 'negative'}`}>
                          Mastery: {Math.round(prevMastery * 100)}%
                        </span>
                      );
                    })()}
                  </div>
                  <div className="feedback-text">{feedback}</div>

                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleNext} id="next-btn">
                      {session.questionsAnswered >= 8 ? '🏁 Finish Session' : '➡️ Next Question'}
                    </button>
                    <button className="btn btn-secondary" onClick={endSession} id="end-session-btn">
                      End Session
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Session Complete */}
      {view === 'quiz' && sessionComplete && session && (
        <div className="quiz-container">
          <div className="glass-card session-complete">
            <div className="session-complete-icon">🎉</div>
            <h2>Session Complete!</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>
              Great work on {getTopicById(session.currentTopicId)?.name}!
            </p>

            <div className="session-stats">
              <div className="session-stat">
                <div className="session-stat-value" style={{ color: 'var(--color-green)' }}>
                  {session.correctInSession}
                </div>
                <div className="session-stat-label">Correct</div>
              </div>
              <div className="session-stat">
                <div className="session-stat-value">{session.questionsAnswered}</div>
                <div className="session-stat-label">Total</div>
              </div>
              <div className="session-stat">
                <div className="session-stat-value" style={{ color: 'var(--color-accent-light)' }}>
                  {session.questionsAnswered > 0
                    ? Math.round((session.correctInSession / session.questionsAnswered) * 100)
                    : 0}%
                </div>
                <div className="session-stat-label">Accuracy</div>
              </div>
              <div className="session-stat">
                <div className="session-stat-value" style={{ color: 'var(--color-cyan)' }}>
                  {Math.round((profile.masteryStates[session.currentTopicId]?.probability ?? 0) * 100)}%
                </div>
                <div className="session-stat-label">Mastery</div>
              </div>
            </div>

            <div className="session-actions">
              <button className="btn btn-primary btn-lg" onClick={() => startQuiz(session.currentTopicId)}>
                🔁 Practice Again
              </button>
              <button className="btn btn-secondary btn-lg" onClick={endSession}>
                📊 Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Learning Path View */}
      {view === 'path' && (
        <div className="learning-path">
          <div className="section-header">
            <div>
              <div className="section-title">🗺️ Your Learning Path</div>
              <div className="section-subtitle">Personalized study plan based on your performance</div>
            </div>
          </div>

          {learningPath.length === 0 ? (
            <div className="glass-card empty-state">
              <div className="empty-icon">🚀</div>
              <div className="empty-title">Start Learning!</div>
              <div className="empty-text">
                Answer some quiz questions first and I&apos;ll create a personalized learning path for you.
              </div>
              <button className="btn btn-primary btn-lg" onClick={() => setView('dashboard')}>
                Go to Dashboard
              </button>
            </div>
          ) : (
            learningPath.map((step, idx) => (
              <div key={step.topicId} className="path-step">
                <div
                  className="path-step-number"
                  style={{
                    borderColor: step.currentMastery < 0.3 ? 'var(--color-red)' : step.currentMastery < 0.6 ? 'var(--color-amber)' : 'var(--color-green)',
                    color: step.currentMastery < 0.3 ? 'var(--color-red)' : step.currentMastery < 0.6 ? 'var(--color-amber)' : 'var(--color-green)',
                  }}
                >
                  {idx + 1}
                </div>
                <div className="glass-card path-step-content" style={{ cursor: 'pointer' }} onClick={() => startQuiz(step.topicId)}>
                  <div className="path-step-title">{step.topicName}</div>
                  <div className="path-step-reason">{step.reason}</div>
                  <div className="path-step-meta">
                    <span>📊 Current: {Math.round(step.currentMastery * 100)}%</span>
                    <span>🎯 Target: {Math.round(step.targetMastery * 100)}%</span>
                    <span>❓ ~{step.estimatedQuestions} questions</span>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div className="progress-bar-container" style={{ width: '100%' }}>
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${Math.round((step.currentMastery / step.targetMastery) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Analytics View */}
      {view === 'analytics' && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="section-header">
            <div>
              <div className="section-title">📈 Performance Analytics</div>
              <div className="section-subtitle">Detailed breakdown of your learning progress</div>
            </div>
          </div>

          {/* Per-subject breakdown */}
          {SUBJECTS.map(subject => {
            const subjectTopics = subject.topics;
            const subjectAttempts = subjectTopics.reduce(
              (sum, t) => sum + (profile.masteryStates[t.id]?.attempts ?? 0), 0
            );
            const avgMastery = subjectTopics.reduce(
              (sum, t) => sum + (profile.masteryStates[t.id]?.probability ?? 0), 0
            ) / subjectTopics.length;

            return (
              <div key={subject.id} className="glass-card" style={{ marginBottom: 20, '--subject-color': subject.color } as React.CSSProperties}>
                <div className="subject-header">
                  <div className="subject-icon" style={{ background: `${subject.color}22` }}>
                    {subject.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="subject-name">{subject.name}</div>
                    <div className="subject-desc">
                      Avg Mastery: {Math.round(avgMastery * 100)}% · {subjectAttempts} attempts
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  {subjectTopics.map(topic => {
                    const state = profile.masteryStates[topic.id];
                    const mastery = state?.probability ?? 0;
                    const attempts = state?.attempts ?? 0;
                    const correct = state?.correctCount ?? 0;
                    const prediction = state && attempts > 2 ? predictPerformance(state) : null;

                    return (
                      <div
                        key={topic.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          padding: '12px 0',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{topic.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {attempts} attempts · {attempts > 0 ? Math.round((correct / attempts) * 100) : 0}% accuracy
                            {prediction && prediction.trajectorySlope !== 0 && (
                              <span style={{ marginLeft: 8, color: prediction.trajectorySlope > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                {prediction.trajectorySlope > 0 ? '📈' : '📉'} Predicted 30d: {Math.round(prediction.predictedMastery30Days * 100)}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="progress-bar-container" style={{ width: 120 }}>
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.round(mastery * 100)}%`,
                              background: mastery > 0.7
                                ? 'var(--color-green)'
                                : mastery > 0.4
                                  ? 'var(--color-amber)'
                                  : 'var(--color-red)',
                            }}
                          />
                        </div>
                        <span className="progress-value">{Math.round(mastery * 100)}%</span>

                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => startQuiz(topic.id)}
                          id={`practice-${topic.id}`}
                        >
                          Practice
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
