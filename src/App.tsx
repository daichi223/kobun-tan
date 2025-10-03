import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dataParser } from './utils/dataParser';
import { Word, MultiMeaningWord } from './types';
import RangeField from './components/RangeField';
import ExampleDisplay from './components/ExampleDisplay';

type AppMode = 'word' | 'polysemy';
type WordQuizType = 'word-meaning' | 'word-reverse' | 'sentence-meaning' | 'meaning-writing';
type PolysemyQuizType = 'example-comprehension' | 'true-false' | 'context-writing';

interface QuizQuestion {
  correct: Word;
  options: Word[];
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
}

interface TrueFalseQuestion {
  example: string;
  meaning: string;
  isCorrect: boolean;
  correctAnswer: Word;
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
  senseId?: string;
}

interface PolysemyState {
  currentWordIndex: number;
  currentExampleIndex: number;
  words: MultiMeaningWord[];
  userAnswers: any[];
  quizType: PolysemyQuizType;
}

function App() {
  // Core state
  const [currentMode, setCurrentMode] = useState<AppMode>('word');
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI refs for focus management
  const wordQuizTypeRef = useRef<HTMLSelectElement>(null);
  const polysemyQuizTypeRef = useRef<HTMLSelectElement>(null);

  // Word mode settings
  const [wordQuizType, setWordQuizType] = useState<WordQuizType>('word-meaning');
  const [wordRange, setWordRange] = useState<{from?: number; to?: number}>({ from: 1, to: 50 });
  const [wordNumQuestions, setWordNumQuestions] = useState(10);

  // Polysemy mode settings
  const [polysemyQuizType, setPolysemyQuizType] = useState<PolysemyQuizType>('example-comprehension');
  const [polysemyRange, setPolysemyRange] = useState<{from?: number; to?: number}>({ from: 1, to: 10 });
  const [polysemyNumQuestions, setPolysemyNumQuestions] = useState(5);

  // Quiz state
  const [currentQuizData, setCurrentQuizData] = useState<QuizQuestion[] | TrueFalseQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [nextButtonVisible, setNextButtonVisible] = useState(false);
  const [showWritingResult, setShowWritingResult] = useState(false);
  const [writingResult, setWritingResult] = useState<{score: number; feedback: string}>({ score: 0, feedback: '' });
  const [showCorrectCircle, setShowCorrectCircle] = useState(false);

  // Polysemy mode state
  const [polysemyState, setPolysemyState] = useState<PolysemyState>({
    currentWordIndex: 0,
    currentExampleIndex: 0,
    words: [],
    userAnswers: [],
    quizType: 'example-comprehension'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (allWords.length > 0) {
      setupQuiz();
    }
  }, [
    currentMode,
    wordQuizType, wordRange.from, wordRange.to, wordNumQuestions,
    polysemyQuizType, polysemyRange.from, polysemyRange.to, polysemyNumQuestions,
    allWords
  ]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await dataParser.loadData();
      const words = dataParser.getAllWords();
      setAllWords(words);
      setError(null);
    } catch (err) {
      setError('データの読み込みに失敗しました。');
      console.error('Data loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showErrorMessage = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };

  const validateRangeInput = (start: number | undefined, end: number | undefined, maxValue: number = 330) => {
    if (start !== undefined && end !== undefined) {
      if (start > end) {
        showErrorMessage('開始値は終了値以下である必要があります。');
        return false;
      }
      if (start > maxValue || end > maxValue) {
        showErrorMessage(`値は${maxValue}以下である必要があります。`);
        return false;
      }
    }
    if (start !== undefined && start < 1) {
      showErrorMessage('開始値は1以上である必要があります。');
      return false;
    }
    if (end !== undefined && end < 1) {
      showErrorMessage('終了値は1以上である必要があります。');
      return false;
    }
    return true;
  };

  const getPolysemyWords = (words: Word[], rangeStart: number, rangeEnd: number): MultiMeaningWord[] => {
    const wordGroups: { [key: string]: Word[] } = {};

    words.forEach(word => {
      // Defensive check: ensure word exists and has required properties
      if (!word || !word.lemma || typeof word.lemma !== 'string') {
        console.warn('Invalid word object found:', word);
        return;
      }

      if (word.group >= rangeStart && word.group <= rangeEnd) {
        if (!wordGroups[word.lemma]) {
          wordGroups[word.lemma] = [];
        }
        wordGroups[word.lemma].push(word);
      }
    });

    return Object.entries(wordGroups)
      .filter(([_, meanings]) => meanings.length >= 2)
      .map(([lemma, meanings]) => ({ lemma, meanings }));
  };

  const setupQuiz = () => {
    // Reset all quiz states when switching modes
    setShowResults(false);
    setIsQuizActive(false);
    setCurrentQuestionIndex(0);
    setCurrentQuizData([]);
    setScore(0);
    setNextButtonVisible(false);
    setShowWritingResult(false);
    setShowCorrectCircle(false);

    if (currentMode === 'word') {
      setupWordQuiz();
    } else {
      setupPolysemyQuiz();
    }
  };

  const setupWordQuiz = () => {
    const start = wordRange.from ?? 1;
    const end = wordRange.to ?? 330;
    const targetWords = allWords.filter(word =>
      word.group >= start && word.group <= end
    );

    if (targetWords.length < 4) {
      if (allWords.length > 0) {
        showErrorMessage('出題範囲の単語が少なすぎます。4つ以上の意味を持つ単語が含まれる範囲を選択してください。');
      }
      return;
    }

    const quizData: QuizQuestion[] = [];
    const usedIndexes = new Set();
    const maxQuestions = new Set(targetWords.map(w => w.qid)).size;
    const actualNumQuestions = Math.min(wordNumQuestions, maxQuestions);

    for (let i = 0; i < actualNumQuestions; i++) {
      let correctWordIndex;
      do {
        correctWordIndex = Math.floor(Math.random() * targetWords.length);
      } while (usedIndexes.has(targetWords[correctWordIndex].qid));

      usedIndexes.add(targetWords[correctWordIndex].qid);

      const correctWord = targetWords[correctWordIndex];

      // Get examples for the correct word (sense-priority)
      const multiMeaningWord = dataParser.getWordByLemma(correctWord.lemma);
      const examples = dataParser.getExamplesForSense(correctWord, correctWord.qid, multiMeaningWord);

      // Select a random example index if examples are available
      const exampleIndex = examples.kobun.length > 0 ? Math.floor(Math.random() * examples.kobun.length) : 0;
      const exampleKobun = examples.kobun[exampleIndex] || '';
      const exampleModern = examples.modern[exampleIndex] || '';

      const incorrectOptions: Word[] = [];

      if (wordQuizType === 'sentence-meaning') {
        // Same word different meanings first
        const sameWordMeanings = allWords.filter(w =>
          w.lemma === correctWord.lemma && w.qid !== correctWord.qid
        );

        sameWordMeanings.forEach(meaning => {
          if (incorrectOptions.length < 2) {
            incorrectOptions.push(meaning);
          }
        });

        // Fill with other words
        while (incorrectOptions.length < 3) {
          const randomWord = allWords[Math.floor(Math.random() * allWords.length)];

          // Defensive check: ensure randomWord exists and has required properties
          if (!randomWord || !randomWord.lemma || !randomWord.sense) {
            continue;
          }

          if (randomWord.sense !== correctWord.sense &&
              !incorrectOptions.some(opt => opt && opt.sense === randomWord.sense) &&
              randomWord.lemma !== correctWord.lemma) {
            incorrectOptions.push(randomWord);
          }
        }
      } else {
        while (incorrectOptions.length < 3) {
          const randomWord = allWords[Math.floor(Math.random() * allWords.length)];

          // Defensive check: ensure randomWord exists and has required properties
          if (!randomWord || !randomWord.lemma || !randomWord.sense) {
            continue;
          }

          if (wordQuizType === 'word-reverse') {
            if (randomWord.lemma !== correctWord.lemma &&
                !incorrectOptions.some(opt => opt && opt.lemma === randomWord.lemma)) {
              incorrectOptions.push(randomWord);
            }
          } else {
            if (randomWord.sense !== correctWord.sense &&
                !incorrectOptions.some(opt => opt && opt.sense === randomWord.sense)) {
              incorrectOptions.push(randomWord);
            }
          }
        }
      }

      const options = [correctWord, ...incorrectOptions].sort(() => Math.random() - 0.5);
      quizData.push({
        correct: correctWord,
        options,
        exampleIndex,
        exampleKobun: dataParser.getEmphasizedExample(exampleKobun, correctWord.lemma),
        exampleModern
      });
    }

    setCurrentQuizData(quizData);
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsQuizActive(true);
    setShowResults(false);
    setNextButtonVisible(false);
    setShowWritingResult(false);
  };

  const setupPolysemyQuiz = () => {
    const start = polysemyRange.from ?? 1;
    const end = polysemyRange.to ?? 330;
    const polysemyWords = getPolysemyWords(allWords, start, end);

    if (polysemyWords.length === 0) {
      if (allWords.length > 0) {
        showErrorMessage('指定された範囲に多義語が見つかりません。');
      }
      return;
    }

    const selectedWords = polysemyWords.slice(0, Math.min(polysemyNumQuestions, polysemyWords.length));

    setPolysemyState({
      currentWordIndex: 0,
      currentExampleIndex: 0,
      words: selectedWords,
      userAnswers: [],
      quizType: polysemyQuizType
    });

    if (polysemyQuizType === 'true-false') {
      setupTrueFalseQuiz(selectedWords);
    } else {
      setCurrentQuizData([]);
    }

    setCurrentQuestionIndex(0);
    setScore(0);
    setIsQuizActive(true);
    setShowResults(false);
    setNextButtonVisible(false);
    setShowWritingResult(false);
  };

  const setupTrueFalseQuiz = (words: MultiMeaningWord[]) => {
    const questions: TrueFalseQuestion[] = [];
    const numQuestions = words.length * 3;

    for (let i = 0; i < numQuestions; i++) {
      const wordGroup = words[i % words.length];
      const isCorrect = Math.random() < 0.5;

      if (isCorrect) {
        const correctMeaning = wordGroup.meanings[Math.floor(Math.random() * wordGroup.meanings.length)];

        // Get examples for the correct meaning (sense-priority)
        const examples = dataParser.getExamplesForSense(correctMeaning, correctMeaning.qid, wordGroup);
        const exampleIndex = examples.kobun.length > 0 ? Math.floor(Math.random() * examples.kobun.length) : 0;

        questions.push({
          example: correctMeaning.examples[0].jp,
          meaning: correctMeaning.sense,
          isCorrect: true,
          correctAnswer: correctMeaning,
          exampleIndex,
          exampleKobun: dataParser.getEmphasizedExample(examples.kobun[exampleIndex] || '', correctMeaning.lemma),
          exampleModern: examples.modern[exampleIndex] || '',
          senseId: correctMeaning.qid
        });
      } else {
        const randomExample = wordGroup.meanings[Math.floor(Math.random() * wordGroup.meanings.length)];
        let wrongMeaning: Word;

        if (Math.random() < 0.5 && wordGroup.meanings.length > 1) {
          do {
            wrongMeaning = wordGroup.meanings[Math.floor(Math.random() * wordGroup.meanings.length)];
          } while (wrongMeaning.qid === randomExample.qid);
        } else {
          wrongMeaning = allWords[Math.floor(Math.random() * allWords.length)];
          while (wrongMeaning && wrongMeaning.lemma === wordGroup.lemma) {
            wrongMeaning = allWords[Math.floor(Math.random() * allWords.length)];
            // Prevent infinite loop if no valid words are found
            if (!wrongMeaning || !wrongMeaning.lemma) {
              break;
            }
          }
        }

        // Get examples for the random example (sense-priority)
        const examples = dataParser.getExamplesForSense(randomExample, randomExample.qid, wordGroup);
        const exampleIndex = examples.kobun.length > 0 ? Math.floor(Math.random() * examples.kobun.length) : 0;

        questions.push({
          example: randomExample.examples[0].jp,
          meaning: wrongMeaning.sense,
          isCorrect: false,
          correctAnswer: randomExample,
          exampleIndex,
          exampleKobun: dataParser.getEmphasizedExample(examples.kobun[exampleIndex] || '', randomExample.lemma),
          exampleModern: examples.modern[exampleIndex] || '',
          senseId: randomExample.qid
        });
      }
    }

    setCurrentQuizData(questions.sort(() => Math.random() - 0.5));
  };

  const evaluateWritingAnswer = (userAnswer: string, correctAnswer: string) => {
    const cleanUserAnswer = userAnswer.trim().toLowerCase();

    // Extract content from 〔〕 brackets as the correct answer
    const bracketMatch = correctAnswer.match(/〔\s*(.+?)\s*〕/);
    const cleanCorrectAnswer = bracketMatch ? bracketMatch[1].trim().toLowerCase() : correctAnswer.trim().toLowerCase();

    if (cleanUserAnswer === cleanCorrectAnswer) {
      return { score: 100, feedback: '完全に正解です！' };
    }

    if (cleanUserAnswer.includes(cleanCorrectAnswer) || cleanCorrectAnswer.includes(cleanUserAnswer)) {
      return { score: 70, feedback: '惜しいです。部分的に正解していますが、より正確な表現を心がけましょう。' };
    }

    return { score: 0, feedback: '不正解です。正解を確認して、再度学習してみましょう。' };
  };

  const handleAnswer = (selectedOption: Word, correctOption: Word, isReverse = false) => {
    const isCorrect = selectedOption.qid === correctOption.qid;
    if (isCorrect) {
      setScore(prev => prev + 1);
      setShowCorrectCircle(true);
      setTimeout(() => {
        setShowCorrectCircle(false);
        setCurrentQuestionIndex(prev => prev + 1);
        setNextButtonVisible(false);
      }, 800);
    } else {
      setNextButtonVisible(true);
    }
  };

  const handleTrueFalseAnswer = (userAnswer: boolean) => {
    const question = currentQuizData[currentQuestionIndex] as TrueFalseQuestion;
    const isCorrect = userAnswer === question.isCorrect;

    if (isCorrect) {
      setScore(prev => prev + 1);
      setShowCorrectCircle(true);
      setTimeout(() => {
        setShowCorrectCircle(false);
        setCurrentQuestionIndex(prev => prev + 1);
      }, 800);
    } else {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 2000);
    }
  };

  const handleWritingSubmit = (userAnswer: string, correctAnswer: string) => {
    if (!userAnswer.trim()) {
      showErrorMessage('回答を入力してください。');
      return;
    }

    const evaluation = evaluateWritingAnswer(userAnswer, correctAnswer);
    setWritingResult(evaluation);
    setShowWritingResult(true);

    if (evaluation.score >= 80) {
      setScore(prev => prev + 1);
      setShowCorrectCircle(true);
      setTimeout(() => {
        setShowCorrectCircle(false);
      }, 800);
    }
    setNextButtonVisible(true);
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1);
    setNextButtonVisible(false);
    setShowWritingResult(false);
  };

  const handleExampleComprehensionCheck = (answers: {[key: string]: string}) => {
    const currentWord = polysemyState.words[polysemyState.currentWordIndex];
    let correctCount = 0;

    currentWord.meanings.forEach(meaning => {
      if (answers[meaning.qid] === meaning.qid) {
        correctCount++;
      }
    });

    setScore(prev => prev + correctCount);

    if (correctCount > 0) {
      setShowCorrectCircle(true);
      setTimeout(() => {
        setShowCorrectCircle(false);
        setPolysemyState(prev => ({
          ...prev,
          currentWordIndex: prev.currentWordIndex + 1
        }));
      }, 800);
    } else {
      setTimeout(() => {
        setPolysemyState(prev => ({
          ...prev,
          currentWordIndex: prev.currentWordIndex + 1
        }));
      }, 2000);
    }
  };

  const handleContextWritingNext = () => {
    const newExampleIndex = polysemyState.currentExampleIndex + 1;
    const currentWord = polysemyState.words[polysemyState.currentWordIndex];

    if (newExampleIndex >= currentWord.meanings.length) {
      const newWordIndex = polysemyState.currentWordIndex + 1;
      if (newWordIndex >= polysemyState.words.length) {
        setShowResults(true);
        setIsQuizActive(false);
        return;
      }
      setPolysemyState(prev => ({
        ...prev,
        currentWordIndex: newWordIndex,
        currentExampleIndex: 0
      }));
    } else {
      setPolysemyState(prev => ({
        ...prev,
        currentExampleIndex: newExampleIndex
      }));
    }
    setShowWritingResult(false);
  };

  const restartQuiz = () => {
    setShowResults(false);
    setIsQuizActive(false);
    setupQuiz();
  };

  // Range input completion handlers
  const handleWordRangeComplete = useCallback(() => {
    setTimeout(() => {
      wordQuizTypeRef.current?.focus();
    }, 100);
  }, []);

  const handlePolysemyRangeComplete = useCallback(() => {
    setTimeout(() => {
      polysemyQuizTypeRef.current?.focus();
    }, 100);
  }, []);

  // Check if quiz should end
  useEffect(() => {
    // Skip end check if quiz data is empty (happens during mode switching)
    if (currentQuizData.length === 0) return;

    if (isQuizActive && currentQuestionIndex >= currentQuizData.length) {
      if (currentMode === 'polysemy' && polysemyQuizType !== 'true-false') {
        if (polysemyQuizType === 'example-comprehension' && polysemyState.currentWordIndex >= polysemyState.words.length) {
          setShowResults(true);
          setIsQuizActive(false);
        }
        return;
      }
      setShowResults(true);
      setIsQuizActive(false);
    }
  }, [currentQuestionIndex, currentQuizData.length, isQuizActive, currentMode, polysemyQuizType, polysemyState.currentWordIndex, polysemyState.words.length]);

  const getCurrentQuestion = (): QuizQuestion | null => {
    if (currentMode === 'word' && currentQuestionIndex < currentQuizData.length) {
      return currentQuizData[currentQuestionIndex] as QuizQuestion;
    }
    return null;
  };

  const getCurrentTrueFalseQuestion = (): TrueFalseQuestion | null => {
    if (currentMode === 'polysemy' && polysemyQuizType === 'true-false' && currentQuestionIndex < currentQuizData.length) {
      return currentQuizData[currentQuestionIndex] as TrueFalseQuestion;
    }
    return null;
  };

  const getCurrentPolysemyWord = () => {
    if (currentMode === 'polysemy' && polysemyState.currentWordIndex < polysemyState.words.length) {
      return polysemyState.words[polysemyState.currentWordIndex];
    }
    return null;
  };

  const getProgress = () => {
    if (currentMode === 'word') {
      return {
        current: currentQuestionIndex + 1,
        total: currentQuizData.length,
        percent: Math.round(((currentQuestionIndex + 1) / currentQuizData.length) * 100)
      };
    } else if (currentMode === 'polysemy') {
      if (polysemyQuizType === 'true-false') {
        return {
          current: currentQuestionIndex + 1,
          total: currentQuizData.length,
          percent: Math.round(((currentQuestionIndex + 1) / currentQuizData.length) * 100)
        };
      } else if (polysemyQuizType === 'example-comprehension') {
        return {
          current: polysemyState.currentWordIndex + 1,
          total: polysemyState.words.length,
          percent: Math.round(((polysemyState.currentWordIndex + 1) / polysemyState.words.length) * 100)
        };
      } else if (polysemyQuizType === 'context-writing') {
        const totalExamples = polysemyState.words.reduce((sum, word) => sum + word.meanings.length, 0);
        const completedExamples = polysemyState.words.slice(0, polysemyState.currentWordIndex).reduce((sum, word) => sum + word.meanings.length, 0) + polysemyState.currentExampleIndex;
        return {
          current: completedExamples + 1,
          total: totalExamples,
          percent: Math.round(((completedExamples + 1) / totalExamples) * 100)
        };
      }
    }
    return { current: 1, total: 1, percent: 100 };
  };

  const getTotalScore = () => {
    if (currentMode === 'word') {
      return currentQuizData.length;
    } else if (currentMode === 'polysemy') {
      if (polysemyQuizType === 'example-comprehension') {
        return polysemyState.words.reduce((sum, word) => sum + word.meanings.length, 0);
      } else if (polysemyQuizType === 'context-writing') {
        return polysemyState.words.reduce((sum, word) => sum + word.meanings.length, 0);
      } else {
        return currentQuizData.length;
      }
    }
    return currentQuizData.length;
  };

  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          <div className="text-center p-16">データを読み込んでいます...</div>
        </div>
      </div>
    );
  }

  if (showResults) {
    const totalScore = getTotalScore();
    const percent = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    const isPerfectScore = score === totalScore && totalScore > 0;

    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">クイズ終了！</h1>
            <p className="text-slate-600 text-lg mb-6">お疲れ様でした。</p>

            {/* Perfect Score Celebration */}
            {isPerfectScore && (
              <div className="mb-6">
                <div className="text-8xl text-red-500 font-bold mb-2 animate-bounce">
                  ○
                </div>
                <p className="text-xl font-bold text-red-500 mb-2">パーフェクト！</p>
                <p className="text-lg text-slate-700">すべて正解です！素晴らしい！</p>
              </div>
            )}

            <div className="mb-8">
              <p className={`text-5xl font-bold ${isPerfectScore ? 'text-red-500' : 'text-blue-500'}`}>
                <span>{score}</span> / <span>{totalScore}</span>
              </p>
              <p className="text-slate-500 mt-1">正解率 {percent}%</p>
            </div>
            <button
              onClick={restartQuiz}
              className={`w-full font-bold py-4 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 ${
                isPerfectScore
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              もう一度挑戦する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto p-3 md:p-6">
        {/* Mode Selection Tabs */}
        <div className="flex justify-center border-b border-slate-200 mb-4 bg-white rounded-t-2xl shadow-sm">
          <button
            onClick={() => {
              setShowResults(false);
              setCurrentMode('word');
            }}
            className={`mode-tab ${currentMode === 'word' ? 'active-tab' : ''}`}
            style={{
              padding: '0.75rem 1.5rem',
              fontWeight: 600,
              color: currentMode === 'word' ? '#3b82f6' : '#64748b',
              borderBottom: currentMode === 'word' ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer',
              minHeight: '44px'
            }}
          >
            単語モード
          </button>
          <button
            onClick={() => {
              setShowResults(false);
              setCurrentMode('polysemy');
            }}
            className={`mode-tab ${currentMode === 'polysemy' ? 'active-tab' : ''}`}
            style={{
              padding: '0.75rem 1.5rem',
              fontWeight: 600,
              color: currentMode === 'polysemy' ? '#3b82f6' : '#64748b',
              borderBottom: currentMode === 'polysemy' ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer',
              minHeight: '44px'
            }}
          >
            多義語モード
          </button>
        </div>

        {/* Settings Area */}
        <div className="bg-white p-3 rounded-b-2xl shadow-sm border-x border-b border-slate-200 mb-4">
          {currentMode === 'word' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">クイズ形式</label>
                  <select
                    ref={wordQuizTypeRef}
                    value={wordQuizType}
                    onChange={(e) => setWordQuizType(e.target.value as WordQuizType)}
                    className="w-full p-1.5 bg-slate-100 border border-slate-200 rounded text-xs"
                  >
                    <option value="word-meaning">単語 → 意味</option>
                    <option value="word-reverse">意味 → 単語</option>
                    <option value="sentence-meaning">例文 → 意味</option>
                    <option value="meaning-writing">意味記述</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">問題数</label>
                  <input
                    type="number"
                    value={wordNumQuestions}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        return;
                      }
                      const num = parseInt(value);
                      if (!isNaN(num)) {
                        setWordNumQuestions(Math.max(1, num));
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                        setWordNumQuestions(10);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    min="1"
                    className="w-full p-1.5 bg-slate-100 border border-slate-200 rounded text-center text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">出題範囲</label>
                <RangeField
                  value={wordRange}
                  onChange={setWordRange}
                  min={1}
                  max={330}
                  onRangeComplete={handleWordRangeComplete}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">クイズ形式</label>
                  <select
                    ref={polysemyQuizTypeRef}
                    value={polysemyQuizType}
                    onChange={(e) => setPolysemyQuizType(e.target.value as PolysemyQuizType)}
                    className="w-full p-1.5 bg-slate-100 border border-slate-200 rounded text-xs"
                  >
                    <option value="example-comprehension">例文理解</option>
                    <option value="true-false">正誤問題</option>
                    <option value="context-writing">文脈記述</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">問題数</label>
                  <input
                    type="number"
                    value={polysemyNumQuestions}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        return;
                      }
                      const num = parseInt(value);
                      if (!isNaN(num)) {
                        setPolysemyNumQuestions(Math.max(1, num));
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                        setPolysemyNumQuestions(5);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    min="1"
                    className="w-full p-1.5 bg-slate-100 border border-slate-200 rounded text-center text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">出題範囲</label>
                <RangeField
                  value={polysemyRange}
                  onChange={setPolysemyRange}
                  min={1}
                  max={330}
                  onRangeComplete={handlePolysemyRangeComplete}
                />
              </div>
            </div>
          )}
        </div>


        {/* Correct Answer Circle */}
        {showCorrectCircle && (
          <div className="flex justify-center mb-4">
            <div className="text-9xl text-red-500 font-black" style={{fontWeight: 900, WebkitTextStroke: '8px red'}}>
              ○
            </div>
          </div>
        )}

        {/* Quiz Content */}
        {isQuizActive && !showCorrectCircle && (
          <div className="relative">
            {/* Word Mode Quiz */}
            {currentMode === 'word' && getCurrentQuestion() && (
              <WordQuizContent
                question={getCurrentQuestion()!}
                quizType={wordQuizType}
                onAnswer={handleAnswer}
                onWritingSubmit={handleWritingSubmit}
                nextButtonVisible={nextButtonVisible}
                onNext={handleNextQuestion}
                showWritingResult={showWritingResult}
                writingResult={writingResult}
              />
            )}

            {/* Polysemy Mode Quiz */}
            {currentMode === 'polysemy' && (
              <>
                {polysemyQuizType === 'true-false' && getCurrentTrueFalseQuestion() && (
                  <TrueFalseQuizContent
                    question={getCurrentTrueFalseQuestion()!}
                    onAnswer={handleTrueFalseAnswer}
                  />
                )}

                {polysemyQuizType === 'example-comprehension' && getCurrentPolysemyWord() && (
                  <ExampleComprehensionContent
                    word={getCurrentPolysemyWord()!}
                    onCheck={handleExampleComprehensionCheck}
                  />
                )}

                {polysemyQuizType === 'context-writing' && getCurrentPolysemyWord() && (
                  <ContextWritingContent
                    word={getCurrentPolysemyWord()!}
                    exampleIndex={polysemyState.currentExampleIndex}
                    onWritingSubmit={handleWritingSubmit}
                    onNext={handleContextWritingNext}
                    showWritingResult={showWritingResult}
                    writingResult={writingResult}
                  />
                )}
              </>
            )}

            {/* Progress Bar */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <p className="font-bold text-slate-700">
                  問題 <span>{getProgress().current}</span> / <span>{getProgress().total}</span>
                </p>
                <p className="text-sm font-medium text-slate-500">
                  進捗 <span>{getProgress().percent}</span>%
                </p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${getProgress().percent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Word Quiz Component
interface WordQuizContentProps {
  question: QuizQuestion;
  quizType: WordQuizType;
  onAnswer: (selected: Word, correct: Word, isReverse?: boolean) => void;
  onWritingSubmit: (userAnswer: string, correctAnswer: string) => void;
  nextButtonVisible: boolean;
  onNext: () => void;
  showWritingResult: boolean;
  writingResult: {score: number; feedback: string};
}

function WordQuizContent({
  question,
  quizType,
  onAnswer,
  onWritingSubmit,
  nextButtonVisible,
  onNext,
  showWritingResult,
  writingResult
}: WordQuizContentProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);
  const [selectedOption, setSelectedOption] = useState<Word | null>(null);

  // Reset state when question changes
  React.useEffect(() => {
    setAnsweredCorrectly(null);
    setSelectedOption(null);
    setUserAnswer('');
  }, [question.correct.qid]);

  // Defensive check: ensure question and question.correct exist
  if (!question || !question.correct || !question.correct.lemma) {
    return (
      <div className="text-center p-8">
        <p className="text-slate-500">問題データの読み込み中...</p>
      </div>
    );
  }

  const handleOptionClick = (option: Word) => {
    if (answeredCorrectly !== null) return;

    setSelectedOption(option);
    const isCorrect = option.qid === question.correct.qid;
    setAnsweredCorrectly(isCorrect);
    onAnswer(option, question.correct, quizType === 'word-reverse');
  };

  const handleWritingSubmitClick = () => {
    onWritingSubmit(userAnswer, question.correct.sense);
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  if (quizType === 'meaning-writing') {
    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-slate-800 tracking-wider">{question.correct?.lemma || 'データなし'}</h2>
          <p className="text-slate-500 mt-1 text-sm">古典単語の意味を記述してください</p>
        </div>

        {/* Example Display */}
        <ExampleDisplay
          exampleKobun={question.exampleKobun}
          exampleModern={question.exampleModern}
          phase={showWritingResult ? 'answer' : 'question'}
          className="mb-6"
        />

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            古典単語の意味を記述してください
          </label>
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="w-full p-4 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="古典単語の意味を入力してください..."
          />
          {!showWritingResult && (
            <div className="mt-4 text-center">
              <button
                onClick={handleWritingSubmitClick}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition"
              >
                回答を提出
              </button>
            </div>
          )}
        </div>

        {showWritingResult && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 mb-2">採点結果</h3>
              <div className={`text-3xl font-bold mb-2 ${
                writingResult.score >= 80 ? 'text-green-600' :
                writingResult.score >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {writingResult.score}点
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-600">あなたの回答:</p>
                <p className="text-slate-800 bg-slate-100 p-3 rounded-lg">{userAnswer}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">正解:</p>
                <p className="text-slate-800 bg-green-100 p-3 rounded-lg">
                  {(() => {
                    const bracketMatch = question.correct.sense.match(/〔\s*(.+?)\s*〕/);
                    return bracketMatch ? bracketMatch[1].trim() : question.correct.sense;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">フィードバック:</p>
                <p className="text-slate-700">{writingResult.feedback}</p>
              </div>
            </div>
          </div>
        )}

        {nextButtonVisible && (
          <div className="mt-8 text-center">
            <button
              onClick={onNext}
              className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-lg transition"
            >
              次の問題へ
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-slate-800 tracking-wider">
          {quizType === 'word-meaning' ? (question.correct?.lemma || 'データなし') :
           quizType === 'word-reverse' ? (question.correct?.sense || 'データなし') :
           (question.exampleKobun || question.correct.examples?.[0]?.jp?.replace(
             new RegExp(question.correct.lemma || '', 'g'),
             `〔${question.correct.lemma || ''}〕`
           ) || 'データなし')}
        </h2>
        <p className="text-slate-500 mt-1 text-sm">
          {quizType === 'word-meaning' ? '正しい意味を選択してください' :
           quizType === 'word-reverse' ? '正しい古典単語を選択してください' :
           `例文中の〔${question.correct?.lemma || ''}〕の意味を選択してください`}
        </p>
      </div>

      {/* Example Display for non-sentence-meaning quiz types */}
      {quizType !== 'sentence-meaning' && (
        <ExampleDisplay
          exampleKobun={question.exampleKobun}
          exampleModern={question.exampleModern}
          phase={answeredCorrectly !== null ? 'answer' : 'question'}
          className="mb-6"
        />
      )}

      <div className="space-y-2">
        {(question.options || []).map((option, index) => {
          // Defensive check: ensure option exists and has required properties
          if (!option || (!option.lemma && !option.sense) || !option.qid) {
            return (
              <div key={`invalid-${index}`} className="w-full text-left p-4 border-2 border-red-200 rounded-lg bg-red-50">
                <span className="text-red-600">無効なオプションデータ</span>
              </div>
            );
          }

          let buttonClass = 'w-full text-left p-3 border-2 border-slate-200 rounded-lg transition text-slate-700 font-medium';

          if (answeredCorrectly !== null) {
            buttonClass += ' pointer-events-none opacity-80';
            if (option.qid === question.correct?.qid) {
              buttonClass = buttonClass.replace('border-slate-200', 'border-green-400 bg-green-400 text-white');
            } else if (selectedOption && option.qid === selectedOption.qid && !answeredCorrectly) {
              buttonClass = buttonClass.replace('border-slate-200', 'border-red-400 bg-red-400 text-white');
            }
          } else {
            buttonClass += ' hover:bg-slate-100 hover:border-blue-400';
          }

          return (
            <button
              key={option.qid}
              onClick={() => handleOptionClick(option)}
              className={buttonClass}
              style={{ minHeight: '44px' }}
            >
              <span className="inline-flex items-center justify-center w-6 h-6 mr-4 rounded-full bg-slate-200 text-slate-600 font-bold">
                {optionLabels[index]}
              </span>
              {quizType === 'word-reverse' ? (option.lemma || 'データなし') : (option.sense || 'データなし')}
            </button>
          );
        })}
      </div>

      {nextButtonVisible && (
        <div className="mt-8 text-center">
          <button
            onClick={onNext}
            className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-lg transition"
          >
            次の問題へ
          </button>
        </div>
      )}
    </div>
  );
}

// True False Quiz Component
interface TrueFalseQuizContentProps {
  question: TrueFalseQuestion;
  onAnswer: (answer: boolean) => void;
}

function TrueFalseQuizContent({ question, onAnswer }: TrueFalseQuizContentProps) {
  const [answered, setAnswered] = useState(false);

  // Reset state when question changes
  React.useEffect(() => {
    setAnswered(false);
  }, [question.example, question.meaning]);

  const handleAnswer = (answer: boolean) => {
    if (answered) return;
    setAnswered(true);
    onAnswer(answer);
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold text-slate-700 mb-4">この組み合わせは正しいですか？</h3>
        <div className="bg-slate-100 p-6 rounded-lg mb-6">
          <p className="text-slate-700 mb-4">{question.exampleKobun || question.example}</p>
          <p className="text-sm text-slate-500 mb-2">意味:</p>
          <p className="text-lg font-bold text-slate-800">{question.meaning}</p>
        </div>

        {/* Example Display */}
        <ExampleDisplay
          exampleKobun={question.exampleKobun}
          exampleModern={question.exampleModern}
          phase={answered ? 'answer' : 'question'}
          className="mb-6"
        />

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleAnswer(true)}
            disabled={answered}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg transition disabled:opacity-50"
          >
            正しい
          </button>
          <button
            onClick={() => handleAnswer(false)}
            disabled={answered}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-lg transition disabled:opacity-50"
          >
            正しくない
          </button>
        </div>
      </div>
    </div>
  );
}

// Example Comprehension Component
interface ExampleComprehensionContentProps {
  word: MultiMeaningWord;
  onCheck: (answers: {[key: string]: string}) => void;
}

function ExampleComprehensionContent({ word, onCheck }: ExampleComprehensionContentProps) {
  // Defensive check: ensure word exists and has required properties
  if (!word || !word.lemma || !word.meanings || !Array.isArray(word.meanings)) {
    return (
      <div className="text-center p-8">
        <p className="text-slate-500">単語データが無効です。</p>
      </div>
    );
  }

  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [shuffledMeanings, setShuffledMeanings] = useState<Word[]>([]);
  const [checked, setChecked] = useState(false);

  // Reset state and reshuffle meanings when word changes
  React.useEffect(() => {
    setAnswers({});
    setChecked(false);
    setShuffledMeanings([...word.meanings].sort(() => Math.random() - 0.5));
  }, [word.lemma, word.meanings]);

  const handleAnswerSelect = (exampleQid: string, selectedQid: string) => {
    if (checked) return;
    setAnswers(prev => ({ ...prev, [exampleQid]: selectedQid }));
  };

  const handleCheck = () => {
    if (checked) return;
    setChecked(true);
    onCheck(answers);
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-slate-800 mb-2">{word?.lemma || 'データなし'}</h2>
        <p className="text-slate-500">各例文に対応する意味を選択してください</p>
      </div>

      <div className="space-y-6 mb-6">
        {(word.meanings || []).filter(meaning => meaning && meaning.qid && meaning.examples?.[0]?.jp).map((meaning) => {
          const isCorrect = answers[meaning.qid] === meaning.qid;
          const hasAnswer = answers[meaning.qid];

          // Get sense-priority examples for this meaning
          const examples = dataParser.getExamplesForSense(meaning, meaning.qid, word);
          const exampleIndex = 0; // Use first example for consistency
          const exampleKobun = examples.kobun[exampleIndex] || meaning.examples?.[0]?.jp || '';
          const exampleModern = examples.modern[exampleIndex] || meaning.examples?.[0]?.translation || '';

          let containerClass = 'p-4 rounded-lg';
          if (checked) {
            containerClass += isCorrect ? ' bg-green-100 border-2 border-green-500' : ' bg-red-100 border-2 border-red-500';
          } else {
            containerClass += ' bg-slate-100';
          }

          return (
            <div key={meaning.qid} className={containerClass}>
              <p className="text-slate-700 mb-4">
                {dataParser.getEmphasizedExample(exampleKobun, word.lemma || '') || 'データなし'}
              </p>
              <p className="text-sm font-medium text-slate-600 mb-2 w-full">意味を選択:</p>
              <div className="flex flex-wrap gap-2">
                {shuffledMeanings.filter(m => m && m.qid && m.sense).map((m) => {
                  let buttonClass = 'px-3 py-2 border-2 rounded-md transition text-slate-700 text-sm font-medium';

                  if (checked) {
                    buttonClass += ' pointer-events-none opacity-75 cursor-not-allowed';
                    if (m.qid === meaning.qid) {
                      // Correct answer
                      buttonClass += ' bg-green-500 text-white border-green-500';
                    } else if (answers[meaning.qid] === m.qid) {
                      // Selected wrong answer
                      buttonClass += ' bg-red-400 text-white border-red-400';
                    } else {
                      buttonClass += ' bg-white border-slate-200';
                    }
                  } else {
                    if (answers[meaning.qid] === m.qid) {
                      buttonClass += ' bg-blue-500 text-white border-blue-500';
                    } else {
                      buttonClass += ' bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-400';
                    }
                  }

                  return (
                    <button
                      key={m.qid}
                      onClick={() => handleAnswerSelect(meaning.qid, m.qid)}
                      className={buttonClass}
                    >
                      {m.sense || 'データなし'}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!checked && (
        <div className="text-center">
          <button
            onClick={handleCheck}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition"
          >
            答え合わせ
          </button>
        </div>
      )}
    </div>
  );
}

// Context Writing Component
interface ContextWritingContentProps {
  word: MultiMeaningWord;
  exampleIndex: number;
  onWritingSubmit: (userAnswer: string, correctAnswer: string) => void;
  onNext: () => void;
  showWritingResult: boolean;
  writingResult: {score: number; feedback: string};
}

function ContextWritingContent({
  word,
  exampleIndex,
  onWritingSubmit,
  onNext,
  showWritingResult,
  writingResult
}: ContextWritingContentProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const currentMeaning = word.meanings[exampleIndex];

  // Get sense-priority examples for current meaning
  const examples = dataParser.getExamplesForSense(currentMeaning, currentMeaning.qid, word);
  const selectedExampleIndex = 0; // Use first example for consistency
  const exampleKobun = examples.kobun[selectedExampleIndex] || currentMeaning.examples?.[0]?.jp || '';
  const exampleModern = examples.modern[selectedExampleIndex] || currentMeaning.examples?.[0]?.translation || '';

  // Reset answer when example changes
  React.useEffect(() => {
    setUserAnswer('');
  }, [word.lemma, exampleIndex]);

  const handleSubmit = () => {
    onWritingSubmit(userAnswer, currentMeaning.sense || '');
  };

  useEffect(() => {
    if (showWritingResult) {
      const timer = setTimeout(() => {
        onNext();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showWritingResult, onNext]);

  return (
    <div>
      <div className="text-center mb-4">
        <p className="text-sm text-slate-500">参考：見出し語</p>
        <p className="text-slate-700 font-medium">{word.lemma}</p>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-slate-800 tracking-wider mb-4">
          {dataParser.getEmphasizedExample(exampleKobun, word.lemma)}
        </h2>
        <p className="text-slate-500">例文中の見出し語の意味を記述してください</p>
      </div>

      {/* Example Display */}
      <ExampleDisplay
        exampleKobun={exampleKobun}
        exampleModern={exampleModern}
        phase={showWritingResult ? 'answer' : 'question'}
        className="mb-6"
      />

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          意味を記述してください
        </label>
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          className="w-full p-4 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
          placeholder="例文の文脈に合う意味を入力してください..."
        />
        {!showWritingResult && (
          <div className="mt-4 text-center">
            <button
              onClick={handleSubmit}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition"
            >
              回答を提出
            </button>
          </div>
        )}
      </div>

      {showWritingResult && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">採点結果</h3>
            <div className={`text-3xl font-bold mb-2 ${
              writingResult.score >= 80 ? 'text-green-600' :
              writingResult.score >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {writingResult.score}点
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-600">あなたの回答:</p>
              <p className="text-slate-800 bg-slate-100 p-3 rounded-lg">{userAnswer}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">正解:</p>
              <p className="text-slate-800 bg-green-100 p-3 rounded-lg">
                {(() => {
                  const sense = currentMeaning.sense || 'データなし';
                  const bracketMatch = sense.match(/〔\s*(.+?)\s*〕/);
                  return bracketMatch ? bracketMatch[1].trim() : sense;
                })()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">フィードバック:</p>
              <p className="text-slate-700">{writingResult.feedback}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;