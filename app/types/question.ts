export type QuestionType = "mcq" | "fill_in" | "matching";

export interface MatchingItem {
  key: string;
  text: string;
}

export interface Question {
  id: number;
  section: string;
  section_order: number;
  question_number: number;
  question_type: QuestionType;
  context_text: string | null;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string;
  matching_left: MatchingItem[] | null;
  matching_right: MatchingItem[] | null;
  correct_mapping: Record<string, string> | null;
}

export interface UserAnswer {
  questionId: number;
  // For MCQ: "a"|"b"|"c"|"d"
  // For fill_in: typed text (user self-assesses)
  // For matching: JSON object { a: "X", b: "Y", ... }
  answer: string | Record<string, string>;
  isCorrect: boolean | null; // null = ungraded (fill_in self-assessment)
}

export interface QuizResult {
  questions: Question[];
  userAnswers: UserAnswer[];
  score: number;       // count of correct MCQ + matching; fill_in always 0 (self-assess)
  maxScore: number;    // total MCQ + matching questions
  totalQuestions: number;
}
