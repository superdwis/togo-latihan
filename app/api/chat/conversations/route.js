import {
  databaseErrorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../lib/media-server";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const { data, error } = await auth.supabase
    .from("chat_conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    return databaseErrorResponse(error, "Gagal memuat riwayat percakapan.");
  }
  return jsonResponse({ conversations: data });
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const { data, error } = await auth.supabase
    .from("chat_conversations")
    .insert({ user_id: auth.user.id })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) {
    return databaseErrorResponse(error, "Gagal membuat percakapan baru.");
  }
  return jsonResponse({ conversation: data }, 201);
}
