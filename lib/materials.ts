import { createClient } from "@/lib/supabase/server";
import type { WhiteboardObject } from "@/lib/types";

const MATERIAL_BUCKET = "lesson-materials";

export async function addSignedMaterialUrls(objects: WhiteboardObject[]) {
  const supabase = await createClient();

  return Promise.all(
    objects.map(async (object) => {
      if (object.type !== "image" && object.type !== "pdf") return object;
      const storagePath = typeof object.data.storagePath === "string" ? object.data.storagePath : "";
      if (!storagePath) return object;

      const { data } = await supabase.storage.from(MATERIAL_BUCKET).createSignedUrl(storagePath, 60 * 60);
      return {
        ...object,
        data: {
          ...object.data,
          url: data?.signedUrl ?? object.data.url
        }
      };
    })
  );
}

export { MATERIAL_BUCKET };
