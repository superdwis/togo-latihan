import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { products } from "../../../lib/catalog-products";

export const runtime = "nodejs";

const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 5000000;
const productById = new Map(products.map((product) => [product.id, product]));

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function normalizeItems(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > products.length) {
    return null;
  }
  const normalized = [];
  const seen = new Set();
  for (const item of input) {
    if (
      !item ||
      typeof item.productId !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99 ||
      seen.has(item.productId)
    ) {
      return null;
    }
    const product = productById.get(item.productId);
    if (!product) return null;
    seen.add(item.productId);
    normalized.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
    });
  }
  return normalized;
}

function isHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function parseAmount(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

async function setFailed(supabase, orderId) {
  const { error } = await supabase
    .from("product_orders")
    .update({ status: "failed" })
    .eq("id", orderId);
  if (error) {
    console.error("Could not mark QRIS checkout as failed.", error);
  }
}

export async function POST(request) {
  const accountId = process.env.BUATQRIS_ACCOUNT_ID;
  const secretToken = process.env.BUATQRIS_SECRET_TOKEN;
  const apiUrl = process.env.BUATQRIS_API_URL || "https://api.buatqris.site";
  const mode = process.env.BUATQRIS_MODE || "test";
  const supabase = getSupabase();
  if (!accountId || !secretToken || !supabase) {
    return jsonResponse({ error: "Konfigurasi checkout QRIS belum lengkap." }, 503);
  }
  if (!["test", "live"].includes(mode)) {
    return jsonResponse({ error: "BUATQRIS_MODE harus bernilai test atau live." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Data keranjang tidak valid." }, 400);
  }
  const items = normalizeItems(body?.items);
  if (!items) return jsonResponse({ error: "Produk atau jumlah dalam keranjang tidak valid." }, 400);

  const amount = items.reduce((total, item) => total + item.subtotal, 0);
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return jsonResponse({ error: "Total belanja QRIS harus antara Rp 1.000 dan Rp 5.000.000." }, 400);
  }

  let endpoint;
  try {
    endpoint = new URL(apiUrl);
  } catch {
    return jsonResponse({ error: "Alamat API BuatQris tidak valid." }, 503);
  }
  if (endpoint.protocol !== "https:") {
    return jsonResponse({ error: "Alamat API BuatQris harus menggunakan HTTPS." }, 503);
  }

  const orderId = randomUUID();
  const description = `Pembelian Toko Rona: ${items.map((item) => item.name).join(", ")}`.slice(0, 100);
  const { error: insertError } = await supabase.from("product_orders").insert({
    id: orderId,
    status: "processing",
    amount,
    items,
  });
  if (insertError) {
    console.error("Could not create product order.", insertError);
    return jsonResponse({ error: "Pesanan tidak dapat disimpan. Coba lagi." }, 500);
  }

  const params = new URLSearchParams({
    action: "api_create_qris",
    account_id: accountId,
    secret_token: secretToken,
    amount: String(amount),
    description,
    fee_by: "user",
  });
  if (mode === "test") params.set("test", "1");

  let providerResponse;
  try {
    providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    await setFailed(supabase, orderId);
    console.error("Could not reach BuatQris to create a QRIS payment.", error);
    return jsonResponse({ error: "Layanan QRIS tidak dapat dihubungi. Silakan coba lagi." }, 502);
  }

  let providerResult;
  try {
    providerResult = await providerResponse.json();
  } catch {
    await setFailed(supabase, orderId);
    console.error("BuatQris returned a non-JSON create-payment response.", {
      status: providerResponse.status,
    });
    return jsonResponse({ error: "Respons dari layanan QRIS tidak valid." }, 502);
  }

  const payment = providerResult?.data;
  const transactionId =
    typeof payment?.transaction_id === "string" ? payment.transaction_id.trim() : "";
  const providerAmount = parseAmount(payment?.amount);
  const totalAmount = parseAmount(payment?.total_amount);
  const qrImage =
    typeof payment?.qris_image === "string" &&
    payment.qris_image.length <= 5_000_000 &&
    /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(payment.qris_image)
      ? payment.qris_image
      : null;
  const qrUrl = isHttpsUrl(payment?.qr_url) ? payment.qr_url : null;
  const paymentUrl = isHttpsUrl(payment?.payment_url) ? payment.payment_url : null;
  if (
    !providerResponse.ok ||
    providerResult?.success !== true ||
    !transactionId ||
    providerAmount !== amount ||
    totalAmount === null ||
    (!qrImage && !qrUrl && !paymentUrl)
  ) {
    await setFailed(supabase, orderId);
    const message =
      typeof providerResult?.message === "string"
        ? providerResult.message.slice(0, 250)
        : "Pembayaran QRIS tidak berhasil dibuat.";
    console.error("BuatQris rejected or returned incomplete payment data.", {
      status: providerResponse.status,
      message,
    });
    return jsonResponse({ error: message }, 502);
  }

  const initialStatus = ["pending", "success", "expired", "failed"].includes(payment.status)
    ? payment.status
    : "pending";
  const paymentData = {
    transaction_id: transactionId,
    status: initialStatus,
    is_test: mode === "test",
    total_amount: totalAmount,
    amount_uniq: parseAmount(payment.amount_uniq),
    admin_fee: parseAmount(payment.admin_fee),
    credit_amount: parseAmount(payment.credit_amount),
    fee_by: payment.fee_by === "buyer" ? "buyer" : "user",
    qris_method: typeof payment.qris_method === "string" ? payment.qris_method : null,
    qr_image: qrImage,
    qr_url: qrUrl,
    payment_url: paymentUrl,
    expired_at:
      typeof payment.expired_at === "string" && !Number.isNaN(Date.parse(payment.expired_at))
        ? payment.expired_at
        : null,
  };
  const { error: updateError } = await supabase
    .from("product_orders")
    .update(paymentData)
    .eq("id", orderId);
  if (updateError) {
    console.error("Could not save BuatQris payment details.", updateError);
    return jsonResponse({ error: "Pembayaran dibuat, tetapi data pesanan belum dapat diperbarui." }, 500);
  }

  const { data: earlierEvents, error: eventError } = await supabase
    .from("buatqris_webhook_events")
    .select("event")
    .eq("delivery_id", transactionId)
    .in("event", ["payment.success", "payment.expired", "payment.failed"])
    .order("received_at", { ascending: false })
    .limit(1);
  if (eventError) {
    console.error("Could not reconcile early BuatQris webhook events.", eventError);
    return jsonResponse({ error: "Status pembayaran belum dapat disinkronkan." }, 500);
  }
  const eventStatus = {
    "payment.success": "success",
    "payment.expired": "expired",
    "payment.failed": "failed",
  }[earlierEvents?.[0]?.event];
  if (eventStatus) {
    const { error: reconcileError } = await supabase
      .from("product_orders")
      .update({ status: eventStatus })
      .eq("id", orderId);
    if (reconcileError) {
      console.error("Could not reconcile product order payment status.", reconcileError);
      return jsonResponse({ error: "Status pembayaran belum dapat disinkronkan." }, 500);
    }
    paymentData.status = eventStatus;
  }

  return jsonResponse({
    order: {
      id: orderId,
      transactionId,
      amount,
      totalAmount,
      status: paymentData.status,
      isTest: paymentData.is_test,
      qrImage,
      qrUrl,
      paymentUrl,
      expiredAt: paymentData.expired_at,
    },
  }, 201);
}
