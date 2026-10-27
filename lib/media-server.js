import { createClient } from "@supabase/supabase-js";

export async function getAuthenticatedUser(request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { error: "Silakan login kembali.", status: 401 };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return { error: "Konfigurasi Supabase server belum lengkap.", status: 503 };
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${match[1]}` },
    },
  });
  try {
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data.user) {
      return { error: "Sesi login tidak valid atau sudah berakhir.", status: 401 };
    }
    return { user: data.user, supabase };
  } catch {
    return { error: "Tidak dapat memverifikasi sesi login.", status: 503 };
  }
}

export async function callDriveScript(payload) {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const apiKey = process.env.GOOGLE_APPS_SCRIPT_API_KEY;
  if (!scriptUrl || !apiKey) {
    return {
      error: "Integrasi Google Drive belum dikonfigurasi di server.",
      status: 503,
    };
  }

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, apiKey }),
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      return {
        error: result.error || "Google Apps Script gagal memproses file.",
        status: response.ok ? 502 : response.status,
      };
    }
    return { result };
  } catch (error) {
    console.error("Permintaan ke Google Apps Script gagal.", error);
    return {
      error: "Tidak dapat menghubungi Google Drive. Coba lagi.",
      status: 502,
    };
  }
}

export function jsonResponse(body, status = 200) {
  return Response.json(body, { status });
}
