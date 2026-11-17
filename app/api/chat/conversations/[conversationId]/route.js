import {
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../../lib/media-server";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const { conversationId } = await params;
  if (!UUID_PATTERN.test(conversationId)) {
    return jsonResponse({ error: "ID percakapan tidak valid." }, 400);
  }

  const { data, error } = await auth.supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .select("id")
    .maybeSingle();
  if (error) return jsonResponse({ error: "Gagal menghapus percakapan." }, 500);
  if (!data) return jsonResponse({ error: "Percakapan tidak ditemukan." }, 404);
  return jsonResponse({ ok: true });
}
