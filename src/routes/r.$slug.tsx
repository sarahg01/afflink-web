import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Tracking redirect: /r/{slug} -> merchant URL with sub_id appended
export const Route = createFileRoute("/r/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug;
        const { data: link } = await supabaseAdmin
          .from("tracking_links")
          .select("id, user_id, product_id, catalog_products(product_url)")
          .eq("slug", slug)
          .maybeSingle();

        if (!link) {
          return new Response("Link not found", { status: 404 });
        }

        // Increment click counter (fire and forget)
        await supabaseAdmin.rpc("increment_tracking_click", { _slug: slug });

        const productUrl: string = (link as any).catalog_products?.product_url ?? "/";
        // sub_id encodes tracking_link.id so postback can match it
        const sep = productUrl.includes("?") ? "&" : "?";
        const target = `${productUrl}${sep}sub_id=${link.id}&aff=afflink`;

        return new Response(null, {
          status: 302,
          headers: { Location: target, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
