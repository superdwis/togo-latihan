import {
  databaseErrorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../lib/media-server";

export const runtime = "nodejs";
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

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const { data, error } = await auth.supabase
    .from("chatbot_memories")
    .select("id, kind, content, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return databaseErrorResponse(error, "Gagal memuat memory chatbot.");
  return jsonResponse({ memories: data });
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const body = await readJson(request);
  if (body?.tooLarge) {
    return jsonResponse({ error: "Ukuran memory melebihi batas." }, 413);
  }
  const kind = body?.kind;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!ALLOWED_KINDS.has(kind) || !content || content.length > 8000) {
    return jsonResponse(
      { error: "Pilih jenis memory dan isi konten hingga maksimal 8.000 karakter." },
      400,
    );
  }

  const { data, error } = await auth.supabase
    .from("chatbot_memories")
    .insert({ user_id: auth.user.id, kind, content })
    .select("id, kind, content, created_at, updated_at")
    .single();
  if (error) return databaseErrorResponse(error, "Gagal menyimpan memory.");
  return jsonResponse({ memory: data }, 201);
}
