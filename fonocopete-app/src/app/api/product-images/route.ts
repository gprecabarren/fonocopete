import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { noStoreHeaders } from "@/lib/no-store";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const bucketId = "product-images";
const maxFileSize = 5 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: noStoreHeaders });
  }

  const body = await request.formData();
  const candidate = body.get("file");

  if (!candidate || typeof candidate === "string") {
    return NextResponse.json({ error: "Selecciona una imagen valida." }, { status: 400, headers: noStoreHeaders });
  }

  if (!supportedTypes.has(candidate.type)) {
    return NextResponse.json({ error: "La imagen debe ser JPG, PNG o WebP." }, { status: 400, headers: noStoreHeaders });
  }

  if (!candidate.size || candidate.size > maxFileSize) {
    return NextResponse.json({ error: "La imagen debe pesar menos de 5 MB." }, { status: 400, headers: noStoreHeaders });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage no esta configurado." }, { status: 503, headers: noStoreHeaders });
  }

  const { error: bucketError } = await supabase.storage.createBucket(bucketId, {
    public: true,
    fileSizeLimit: String(maxFileSize),
    allowedMimeTypes: [...supportedTypes],
  });

  if (bucketError && String(bucketError.statusCode) !== "409") {
    return NextResponse.json({ error: "No se pudo preparar el almacenamiento de imagenes." }, { status: 500, headers: noStoreHeaders });
  }

  const objectPath = `products/${crypto.randomUUID()}.${extensionFor(candidate.type)}`;
  const { error: uploadError } = await supabase.storage.from(bucketId).upload(objectPath, await candidate.arrayBuffer(), {
    contentType: candidate.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500, headers: noStoreHeaders });
  }

  const { data } = supabase.storage.from(bucketId).getPublicUrl(objectPath);
  return NextResponse.json({ imageUrl: data.publicUrl }, { headers: noStoreHeaders });
}
