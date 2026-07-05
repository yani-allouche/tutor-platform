"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createBoard(lessonId: string) {
  const supabase = await createClient();
  const { data: existing, error: countError } = await supabase
    .from("boards")
    .select("id")
    .eq("lesson_id", lessonId);

  if (countError) throw new Error(countError.message);

  const nextOrder = (existing?.length ?? 0) + 1;
  const { error } = await supabase.from("boards").insert({
    lesson_id: lessonId,
    name: `Board ${nextOrder}`,
    order: nextOrder
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/lessons/${lessonId}`);
}

export async function renameBoard(lessonId: string, boardId: string, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { error } = await supabase.from("boards").update({ name }).eq("id", boardId).eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);

  revalidatePath(`/lessons/${lessonId}`);
}

export async function deleteBoard(lessonId: string, boardId: string) {
  const supabase = await createClient();
  const { data: boards, error: boardsError } = await supabase
    .from("boards")
    .select('id,"order"')
    .eq("lesson_id", lessonId)
    .order("order", { ascending: true });

  if (boardsError) throw new Error(boardsError.message);
  if ((boards?.length ?? 0) <= 1) return;

  const { error } = await supabase.from("boards").delete().eq("id", boardId).eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);

  await normalizeBoardOrder(lessonId);
  revalidatePath(`/lessons/${lessonId}`);
}

export async function duplicateBoard(lessonId: string, boardId: string) {
  const supabase = await createClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select('name,"order"')
    .eq("id", boardId)
    .eq("lesson_id", lessonId)
    .single();

  if (boardError || !board) throw new Error(boardError?.message ?? "Board not found");

  const { data: allBoards, error: allBoardsError } = await supabase
    .from("boards")
    .select("id")
    .eq("lesson_id", lessonId);

  if (allBoardsError) throw new Error(allBoardsError.message);

  const { data: copiedBoard, error: copyError } = await supabase
    .from("boards")
    .insert({
      lesson_id: lessonId,
      name: `${board.name} copy`,
      order: (allBoards?.length ?? 0) + 1
    })
    .select("id")
    .single();

  if (copyError) throw new Error(copyError.message);

  const { data: objects, error: objectsError } = await supabase
    .from("whiteboard_objects")
    .select("type,x,y,width,height,rotation,z_index,data")
    .eq("board_id", boardId);

  if (objectsError) throw new Error(objectsError.message);

  if (objects?.length) {
    const { error: insertError } = await supabase.from("whiteboard_objects").insert(
      objects.map((object) => ({
        ...object,
        board_id: copiedBoard.id
      }))
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath(`/lessons/${lessonId}`);
}

export async function moveBoard(lessonId: string, boardId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: boards, error } = await supabase
    .from("boards")
    .select('id,"order"')
    .eq("lesson_id", lessonId)
    .order("order", { ascending: true });

  if (error) throw new Error(error.message);
  if (!boards?.length) return;

  const index = boards.findIndex((board) => board.id === boardId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= boards.length) return;

  const current = boards[index];
  const target = boards[targetIndex];

  const { error: currentError } = await supabase.from("boards").update({ order: target.order }).eq("id", current.id);
  if (currentError) throw new Error(currentError.message);

  const { error: targetError } = await supabase.from("boards").update({ order: current.order }).eq("id", target.id);
  if (targetError) throw new Error(targetError.message);

  revalidatePath(`/lessons/${lessonId}`);
}

async function normalizeBoardOrder(lessonId: string) {
  const supabase = await createClient();
  const { data: boards, error } = await supabase
    .from("boards")
    .select("id")
    .eq("lesson_id", lessonId)
    .order("order", { ascending: true });

  if (error) throw new Error(error.message);

  await Promise.all(
    (boards ?? []).map((board, index) => supabase.from("boards").update({ order: index + 1 }).eq("id", board.id))
  );
}
