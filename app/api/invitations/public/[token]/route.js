import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getToken(params) {
  const { token } = await params;
  return UUID_PATTERN.test(token || "") ? token : null;
}

export async function GET(_request, { params }) {
  const token = await getToken(params);
  if (!token) return jsonResponse({ error: "Tautan undangan tidak valid." }, 400);

  const supabase = getPublicSupabase();
  if (!supabase) {
    return jsonResponse({ error: "Konfigurasi Supabase belum lengkap." }, 503);
  }

  const { data, error } = await supabase.rpc("get_public_invitation", {
    p_token: token,
  });
  if (error) {
    console.error("Could not load public invitation.", error);
    return jsonResponse({ error: "Undangan tidak dapat dimuat saat ini." }, 500);
  }
  if (!data?.length) return jsonResponse({ error: "Undangan tidak ditemukan." }, 404);
  return jsonResponse({ invitation: data[0] });
}

export async function POST(request, { params }) {
  const token = await getToken(params);
  if (!token) return jsonResponse({ error: "Tautan undangan tidak valid." }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Data konfirmasi tidak valid." }, 400);
  }
  const status = body?.status;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!["attending", "not_attending", "maybe"].includes(status)) {
    return jsonResponse({ error: "Pilih status konfirmasi kehadiran." }, 400);
  }
  if (message.length > 2000) {
    return jsonResponse({ error: "Pesan maksimal 2.000 karakter." }, 400);
  }

  const supabase = getPublicSupabase();
  if (!supabase) {
    return jsonResponse({ error: "Konfigurasi Supabase belum lengkap." }, 503);
  }

  const { data, error } = await supabase.rpc("submit_public_invitation_rsvp", {
    p_token: token,
    p_status: status,
    p_message: message || null,
  });
  if (error) {
    console.error("Could not save public invitation RSVP.", error);
    return jsonResponse({ error: "Konfirmasi gagal disimpan." }, 500);
  }
  if (!data) return jsonResponse({ error: "Undangan tidak ditemukan." }, 404);
  return jsonResponse({ ok: true });
}
