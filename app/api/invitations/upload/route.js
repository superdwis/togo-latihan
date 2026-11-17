import { randomUUID } from "node:crypto";
import {
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../lib/media-server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "Form upload tidak valid." }, 400);
  }

  const eventId = formData.get("eventId");
  const file = formData.get("file");
  if (
    typeof eventId !== "string" ||
    !UUID_PATTERN.test(eventId) ||
    !file ||
    typeof file !== "object" ||
    typeof file.arrayBuffer !== "function"
  ) {
    return jsonResponse({ error: "Acara atau file foto tidak valid." }, 400);
  }

  const { data: event, error: eventError } = await auth.supabase
    .from("invitation_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) {
    return jsonResponse({ error: "Tidak dapat memverifikasi pemilik acara." }, 500);
  }
  if (!event) {
    return jsonResponse({ error: "Acara tidak ditemukan atau bukan milik akun ini." }, 404);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return jsonResponse({ error: "Gunakan foto JPG, PNG, GIF, WebP, atau AVIF." }, 415);
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return jsonResponse({ error: "Ukuran foto maksimal 10 MB." }, 413);
  }

  const safeName = file.name
    .normalize("NFKD")
    .replace(/[^\w.-]/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);
  const filePath = `${auth.user.id}/${eventId}/${randomUUID()}-${safeName || "foto-undangan"}`;
  const { data: uploadedFile, error: uploadError } = await auth.supabase.storage
    .from("invitation-media")
    .upload(filePath, new Uint8Array(await file.arrayBuffer()), {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Could not upload invitation photo to Supabase Storage.", uploadError);
    return jsonResponse({ error: "Foto gagal disimpan ke Supabase Storage." }, 500);
  }

  const { data: publicUrl } = auth.supabase.storage
    .from("invitation-media")
    .getPublicUrl(uploadedFile.path);
  return jsonResponse(
    {
      path: uploadedFile.path,
      url: publicUrl.publicUrl,
    },
    201,
  );
}
