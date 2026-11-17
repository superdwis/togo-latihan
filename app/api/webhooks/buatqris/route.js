import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_EVENTS = new Set([
  "payment.success",
  "payment.expired",
  "payment.failed",
  "withdrawal.pending",
  "withdrawal.approved",
  "withdrawal.rejected",
]);
const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/i;

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getDeliveryId(payload) {
  const identifier = payload.event.startsWith("payment.")
    ? payload.transaction_id
    : payload.withdrawal_id || payload.transaction_id;
  return typeof identifier === "string" && identifier.trim().length <= 120
    ? identifier.trim()
    : null;
}

export async function POST(request) {
  const signingSecret = process.env.BUATQRIS_SIGNING_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!signingSecret || !supabaseUrl || !supabaseSecretKey) {
    return jsonResponse({ error: "Konfigurasi webhook BuatQris belum lengkap." }, 503);
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") {
    return jsonResponse({ error: "Webhook harus menggunakan application/json." }, 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Ukuran webhook terlalu besar." }, 413);
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Ukuran webhook tidak valid." }, 413);
  }

  const signature = request.headers.get("x-buatqris-signature") || "";
  const match = SIGNATURE_PATTERN.exec(signature);
  if (!match) {
    return jsonResponse({ error: "Tanda tangan webhook tidak valid." }, 401);
  }

  const expectedSignature = createHmac("sha256", signingSecret)
    .update(rawBody)
    .digest();
  const receivedSignature = Buffer.from(match[1], "hex");
  if (!timingSafeEqual(expectedSignature, receivedSignature)) {
    return jsonResponse({ error: "Tanda tangan webhook tidak valid." }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return jsonResponse({ error: "Isi webhook bukan JSON yang valid." }, 400);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !ALLOWED_EVENTS.has(payload.event)
  ) {
    return jsonResponse({ error: "Event webhook tidak didukung." }, 400);
  }

  const deliveryId = getDeliveryId(payload);
  if (!deliveryId) {
    return jsonResponse({ error: "ID transaksi webhook tidak valid." }, 400);
  }
  const headerDeliveryId = request.headers.get("x-buatqris-delivery");
  if (headerDeliveryId && headerDeliveryId !== deliveryId) {
    return jsonResponse({ error: "ID pengiriman webhook tidak cocok." }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { error: insertError } = await supabase.from("buatqris_webhook_events").insert({
    event: payload.event,
    delivery_id: deliveryId,
    payload,
  });

  const duplicate = insertError?.code === "23505";
  if (insertError && !duplicate) {
    console.error("Could not save verified BuatQris webhook event.", insertError);
    return jsonResponse({ error: "Webhook belum dapat disimpan." }, 500);
  }

  const paymentStatus = {
    "payment.success": "success",
    "payment.expired": "expired",
    "payment.failed": "failed",
  }[payload.event];
  if (paymentStatus) {
    const { error: updateError } = await supabase
      .from("product_orders")
      .update({ status: paymentStatus })
      .eq("transaction_id", deliveryId)
      .in("status", ["processing", "pending"]);
    if (updateError) {
      console.error("Could not update product order from BuatQris webhook.", updateError);
      return jsonResponse({ error: "Status pesanan belum dapat diperbarui." }, 500);
    }
  }

  return jsonResponse({ received: true, duplicate });
}
