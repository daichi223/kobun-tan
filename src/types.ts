// kobun-app.htmlの仕様に基づく型定義

// 基本的な単語データ
export interface WordData {
  qid: string;
  lemma: string;
  sense: string;
  meaning_idx: number;
  group: string;
  examples: Array<{
    jp: string;
    translation: string;
  }>;
  // 例文機能追加
  examples_kobun?: string[];
  examples_modern?: string[];
}

// 多義語データ（例文機能強化版）
export interface MultiMeaningWord {
  lemma: string;
  meanings: Word[];
  // 多義語専用例文
  examples_by_sense?: ExamplesBySense;
}

// アプリのメインモード
export type AppMode = 'word' | 'polysemy';

// 単語モードのクイズタイプ
export type WordQuizType = 'word-meaning' | 'word-reverse' | 'sentence-meaning' | 'meaning-writing';

// 多義語モードのクイズタイプ
export type PolysemyQuizType = 'example-comprehension' | 'true-false' | 'context-writing';

// 単語モードの設定
export interface WordModeSettings {
  quizType: WordQuizType;
  rangeStart: number;
  rangeEnd: number;
  numQuestions: number;
}

// 多義語モードの設定
export interface PolysemyModeSettings {
  quizType: PolysemyQuizType;
  rangeStart: number;
  rangeEnd: number;
  numQuestions: number;
}

// 統合されたアプリケーション状態
export interface AppState {
  currentMode: AppMode;
  wordModeSettings: WordModeSettings;
  polysemyModeSettings: PolysemyModeSettings;
  isQuizActive: boolean;
  currentQuestionIndex: number;
  score: number;
  showResults: boolean;
}

// 単語→意味クイズの問題
export interface WordMeaningQuestion {
  id: string;
  word: string;
  correctMeaning: string;
  options: string[];
  correctIndex: number;
  example?: string;
  translation?: string;
  // 例文機能追加
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
}

// 意味→単語クイズの問題
export interface MeaningWordQuestion {
  id: string;
  meaning: string;
  correctWord: string;
  options: string[];
  correctIndex: number;
  translation?: string;
  example?: string;
  // 例文機能追加
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
}

// 例文→意味クイズの問題
export interface SentenceMeaningQuestion {
  id: string;
  sentence: string;
  word: string;
  correctMeaning: string;
  options: string[];
  correctIndex: number;
  translation?: string;
  // 例文機能追加
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
}

// 意味記述クイズの問題
export interface MeaningWritingQuestion {
  id: string;
  sentence: string;
  word: string;
  correctMeaning: string;
  translation?: string;
  // 例文機能追加
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
}

// 記述式回答の評価結果
export interface WritingEvaluation {
  score: number; // 0-100
  feedback: string;
  isCorrect: boolean;
}

// 例文理解クイズの問題（多義語モード）
export interface ExampleComprehensionQuestion {
  lemma: string;
  examples: Array<{
    jp: string;
    translation: string;
    correctMeaning: string;
    correctMeaningIdx: number;
    // 例文機能追加
    exampleIndex?: number;
    exampleKobun?: string;
    exampleModern?: string;
    senseId?: string;
  }>;
  meaningOptions: string[];
}

// 正誤問題クイズの問題（多義語モード）
export interface TrueFalseQuestion {
  id: string;
  example: {
    jp: string;
    translation: string;
  };
  meaning: string;
  isCorrect: boolean;
  lemma: string;
  // 例文機能追加
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
  senseId?: string;
}

// 文脈記述クイズの問題（多義語モード）
export interface ContextWritingQuestion {
  id: string;
  lemma: string;
  example: {
    jp: string;
    translation: string;
  };
  correctMeaning: string;
  // 例文機能追加
  exampleIndex?: number;
  exampleKobun?: string;
  exampleModern?: string;
  senseId?: string;
}

// 統合されたクイズ問題型
export type QuizQuestion =
  | WordMeaningQuestion
  | MeaningWordQuestion
  | SentenceMeaningQuestion
  | MeaningWritingQuestion
  | ExampleComprehensionQuestion
  | TrueFalseQuestion
  | ContextWritingQuestion;

// クイズの回答状態
export interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  userAnswers: Array<string | string[] | WritingEvaluation>;
  isCompleted: boolean;
  score: number;
  startTime: Date;
  endTime?: Date;
}

// プログレス表示用
export interface QuizProgress {
  current: number;
  total: number;
  percentage: number;
}

// 結果表示用
export interface QuizResults {
  mode: AppMode;
  quizType: WordQuizType | PolysemyQuizType;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number; // 秒
  accuracy: number; // パーセンテージ
  feedback: string;
}

// エラー状態
export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

// ローディング状態
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// 例文表示設定
export interface ExampleDisplayConfig {
  showKobun: boolean;
  showModern: boolean;
  emphasizeLemma: boolean;
}

// 例文表示状態
export type ExamplePhase = 'question' | 'answer';

// 旧型定義（後方互換性）
export type TabType = 'word' | 'polysemy';

// 例文データ（多義語用）
export interface ExamplesBySense {
  [senseId: string]: {
    kobun: string[];
    modern: string[];
  };
}

// 新しいApp.tsx用のWord型（例文機能強化版）
export interface Word {
  qid: string;
  lemma: string;
  sense: string;
  meaning_idx: number;
  group: number;
  examples: Array<{
    jp: string;
    translation: string;
  }>;
  // 例文機能追加
  examples_kobun?: string[];
  examples_modern?: string[];
}
