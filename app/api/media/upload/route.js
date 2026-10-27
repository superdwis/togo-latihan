import {
  callDriveScript,
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../lib/media-server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
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

  const todoId = formData.get("todoId");
  const file = formData.get("file");
  if (
    typeof todoId !== "string" ||
    !UUID_PATTERN.test(todoId) ||
    !file ||
    typeof file !== "object" ||
    typeof file.arrayBuffer !== "function"
  ) {
    return jsonResponse({ error: "Todo atau file media tidak valid." }, 400);
  }

  const { data: todo, error: todoError } = await auth.supabase
    .from("todos")
    .select("id")
    .eq("id", todoId)
    .maybeSingle();
  if (todoError) {
    return jsonResponse({ error: "Tidak dapat memverifikasi pemilik todo." }, 500);
  }
  if (!todo) {
    return jsonResponse({ error: "Todo tidak ditemukan atau bukan milik akun ini." }, 404);
  }

  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    return jsonResponse({ error: "Format foto atau media ini tidak didukung." }, 415);
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return jsonResponse({ error: "Ukuran file harus lebih dari 0 dan maksimal 20 MB." }, 413);
  }

  const safeName = file.name.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 180);
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const { result, error, status } = await callDriveScript({
    action: "upload",
    userId: auth.user.id,
    todoId,
    fileName: safeName || "todo-media",
    mimeType: file.type,
    base64,
  });

  if (error) return jsonResponse({ error }, status);
  return jsonResponse({ file: result.file }, 201);
}
