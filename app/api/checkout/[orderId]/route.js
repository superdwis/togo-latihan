import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request, { params }) {
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId || "")) {
    return jsonResponse({ error: "ID pesanan tidak valid." }, 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return jsonResponse({ error: "Konfigurasi status pesanan belum lengkap." }, 503);
  }
  const supabase = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase
    .from("product_orders")
    .select("id, transaction_id, status, amount, total_amount, is_test")
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    console.error("Could not load product order status.", error);
    return jsonResponse({ error: "Status pesanan tidak dapat dimuat." }, 500);
  }
  if (!data) return jsonResponse({ error: "Pesanan tidak ditemukan." }, 404);

  return jsonResponse({
    order: {
      id: data.id,
      transactionId: data.transaction_id,
      status: data.status,
      amount: data.amount,
      totalAmount: data.total_amount,
      isTest: data.is_test,
    },
  });
}
