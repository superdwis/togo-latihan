import {
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../../lib/media-server";

export const runtime = "nodejs";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KINDS = new Set(["persona", "product"]);

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 38000) {
    return { tooLarge: true };
  }
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function PATCH(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const { memoryId } = await params;
  if (!UUID_PATTERN.test(memoryId)) {
    return jsonResponse({ error: "ID memory tidak valid." }, 400);
  }
  const body = await readJson(request);
  if (body?.tooLarge) {
    return jsonResponse({ error: "Ukuran memory melebihi batas." }, 413);
  }
  const kind = body?.kind;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!ALLOWED_KINDS.has(kind) || !content || content.length > 8000) {
    return jsonResponse({ error: "Jenis memory atau konten tidak valid." }, 400);
  }

  const { data, error } = await auth.supabase
    .from("chatbot_memories")
    .update({ kind, content })
    .eq("id", memoryId)
    .select("id, kind, content, created_at, updated_at")
    .maybeSingle();
  if (error) return jsonResponse({ error: "Gagal memperbarui memory." }, 500);
  if (!data) return jsonResponse({ error: "Memory tidak ditemukan." }, 404);
  return jsonResponse({ memory: data });
}

export async function DELETE(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const { memoryId } = await params;
  if (!UUID_PATTERN.test(memoryId)) {
    return jsonResponse({ error: "ID memory tidak valid." }, 400);
  }

  const { data, error } = await auth.supabase
    .from("chatbot_memories")
    .delete()
    .eq("id", memoryId)
    .select("id")
    .maybeSingle();
  if (error) return jsonResponse({ error: "Gagal menghapus memory." }, 500);
  if (!data) return jsonResponse({ error: "Memory tidak ditemukan." }, 404);
  return jsonResponse({ ok: true });
}
