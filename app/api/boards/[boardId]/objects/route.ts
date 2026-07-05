import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addSignedMaterialUrls } from "@/lib/materials";
import type { WhiteboardObject } from "@/lib/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whiteboard_objects")
    .select("id,board_id,parent_material_id,page_number,type,x,y,width,height,rotation,z_index,data,created_at,updated_at")
    .eq("board_id", boardId)
    .order("z_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const objects = await addSignedMaterialUrls((data ?? []) as WhiteboardObject[]);
  return NextResponse.json({ objects });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const supabase = await createClient();
  const body = (await request.json()) as { objects?: WhiteboardObject[] };
  const objects = body.objects ?? [];

  const { error: deleteError } = await supabase.from("whiteboard_objects").delete().eq("board_id", boardId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (!objects.length) return NextResponse.json({ objects: [] });

  const payload = objects.map((object, index) => ({
    id: object.id,
    board_id: boardId,
    parent_material_id: object.parent_material_id ?? null,
    page_number: object.page_number ?? null,
    type: object.type,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    z_index: index,
    data: sanitizeObjectData(object)
  }));

  const { data, error } = await supabase
    .from("whiteboard_objects")
    .insert(payload)
    .select("id,board_id,parent_material_id,page_number,type,x,y,width,height,rotation,z_index,data,created_at,updated_at")
    .order("z_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ objects: data ?? [] });
}

function sanitizeObjectData(object: WhiteboardObject) {
  if (object.type !== "image" && object.type !== "pdf") return object.data;
  const data = { ...object.data };
  delete data.url;
  return data;
}
