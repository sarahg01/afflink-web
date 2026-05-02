import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Merchant pings:
// GET /api/public/postback?token=XYZ&sub_id=<tracking_link_id>&amount=999&order_id=ABC&commission=40
//
// - token: per-creator postback token (creator_secrets.postback_token)
// - sub_id: tracking_links.id (we attached this in /r/$slug)
// - amount: total sale amount in INR
// - commission (optional): merchant commission paid; if missing we use brand default % of amount
// - order_id (optional): merchant's order id for dedupe/reference
async function handle(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const subId = url.searchParams.get("sub_id");
  const amountStr = url.searchParams.get("amount");
  const commissionStr = url.searchParams.get("commission");
  const externalOrderId = url.searchParams.get("order_id");

  if (!token || !subId || !amountStr) {
    return new Response("Missing token, sub_id or amount", { status: 400 });
  }

  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response("Invalid amount", { status: 400 });
  }

  // 1. Verify token belongs to a real creator
  const { data: secret } = await supabaseAdmin
    .from("creator_secrets")
    .select("user_id")
    .eq("postback_token", token)
    .maybeSingle();
  if (!secret) return new Response("Invalid token", { status: 401 });

  // 2. Look up tracking link & ensure it belongs to that creator
  const { data: link } = await supabaseAdmin
    .from("tracking_links")
    .select("id, user_id, product_id, catalog_products(brand_id, commission_rate, brands(default_commission_rate))")
    .eq("id", subId)
    .maybeSingle();
  if (!link || link.user_id !== secret.user_id) {
    return new Response("Sub_id mismatch", { status: 403 });
  }

  // 3. Compute commission
  const product: any = (link as any).catalog_products;
  const rate = Number(commissionStr ? null : (product?.commission_rate ?? product?.brands?.default_commission_rate ?? 5));
  const commission = commissionStr
    ? Number(commissionStr)
    : Math.round((amount * rate) / 100 * 100) / 100;
  if (!Number.isFinite(commission) || commission < 0) {
    return new Response("Invalid commission", { status: 400 });
  }

  // 80/20 split
  const creatorEarning = Math.round(commission * 0.8 * 100) / 100;
  const platformFee = Math.round((commission - creatorEarning) * 100) / 100;

  // 4. Dedupe by external_order_id when present
  if (externalOrderId) {
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", link.user_id)
      .eq("external_order_id", externalOrderId)
      .maybeSingle();
    if (existing) return new Response("ok (dup)", { status: 200 });
  }

  // 5. Insert order — trigger credits wallet & creates notification
  const { error } = await supabaseAdmin.from("orders").insert({
    user_id: link.user_id,
    tracking_link_id: link.id,
    brand_id: product?.brand_id ?? null,
    external_order_id: externalOrderId,
    sale_amount: amount,
    commission_amount: commission,
    creator_earning: creatorEarning,
    platform_fee: platformFee,
    status: "confirmed",
  });
  if (error) {
    console.error("postback insert failed", error);
    return new Response("DB error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

export const Route = createFileRoute("/api/public/postback")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
