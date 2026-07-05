import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MATERIAL_BUCKET, addSignedMaterialUrls } from "@/lib/materials";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF, PNG, or JPG file." }, { status: 400 });
  }

  if (!SUPPORTED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file. Upload a PDF, PNG, JPG, or JPEG." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File is too large. Maximum size is 50 MB." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id,lesson_id")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    return NextResponse.json({ error: boardError?.message ?? "Board not found." }, { status: 404 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? (file.type === "application/pdf" ? "pdf" : "jpg");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${board.lesson_id}/${boardId}/${crypto.randomUUID()}-${safeName || `material.${extension}`}`;

  const { error: uploadError } = await supabase.storage.from(MATERIAL_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: uploadedFile, error: fileError } = await supabase
    .from("uploaded_files")
    .insert({
      lesson_id: board.lesson_id,
      board_id: boardId,
      filename: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_url: storagePath
    })
    .select("id,filename,file_type,file_size,storage_url")
    .single();

  if (fileError || !uploadedFile) {
    return NextResponse.json({ error: fileError?.message ?? "Could not save uploaded file." }, { status: 500 });
  }

  const isPdf = file.type === "application/pdf";
  const { data: latestObject, error: latestObjectError } = await supabase
    .from("whiteboard_objects")
    .select("z_index")
    .eq("board_id", boardId)
    .order("z_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestObjectError) {
    return NextResponse.json({ error: latestObjectError.message }, { status: 500 });
  }

  const { data: object, error: objectError } = await supabase
    .from("whiteboard_objects")
    .insert({
      board_id: boardId,
      type: isPdf ? "pdf" : "image",
      x: 80,
      y: 80,
      width: isPdf ? 520 : 420,
      height: isPdf ? 640 : 280,
      rotation: 0,
      z_index: Number(latestObject?.z_index ?? -1) + 1,
      data: {
        fileId: uploadedFile.id,
        filename: uploadedFile.filename,
        fileType: uploadedFile.file_type,
        fileSize: uploadedFile.file_size,
        storagePath: uploadedFile.storage_url,
        page: 1,
        pageCount: isPdf ? null : 1
      }
    })
    .select("id,board_id,type,x,y,width,height,rotation,z_index,data,created_at,updated_at")
    .single();

  if (objectError || !object) {
    return NextResponse.json({ error: objectError?.message ?? "Could not create material object." }, { status: 500 });
  }

  const [signedObject] = await addSignedMaterialUrls([object]);
  return NextResponse.json({ object: signedObject });
}
