export type StudentSummary = {
  id: string;
  name: string;
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
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  student_id: string | null;
  title: string;
  lesson_date: string;
  created_at: string;
  updated_at: string;
};

export type StudentOption = {
  id: string;
  name: string;
};

export type Board = {
  id: string;
  lesson_id: string;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type WhiteboardObjectType =
  | "text"
  | "pencil_stroke"
  | "highlighter_stroke"
  | "shape"
  | "arrow"
  | "image"
  | "pdf"
  | "pdf_annotation";

export type WhiteboardObject = {
  id: string;
  board_id: string;
  parent_material_id?: string | null;
  page_number?: number | null;
  type: WhiteboardObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};
