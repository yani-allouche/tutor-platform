export type StudentSummary = {
  id: string;
  name: string;
  language_learned: string;
  level: string;
  lesson_count: number;
  last_lesson_date: string | null;
};

export type LessonSummary = {
  id: string;
  title: string;
  lesson_date: string;
  updated_at: string;
  student_name: string | null;
  board_count: number;
};

export type Student = {
  id: string;
  name: string;
  language_learned: string;
  level: string;
  goals: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  student_id: string | null;
  title: string;
  lesson_date: string;
  objective: string;
  topic: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type StudentOption = {
  id: string;
  name: string;
};
