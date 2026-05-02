import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import { Copy, Link as LinkIcon } from "lucide-react";

export const Route = createFileRoute("/stores")({
  component: StoresPage,
});

type Brand = { id: string; slug: string; name: string; default_commission_rate: number };
type Product = {
  id: string;
  brand_id: string;
  title: string;
  image_url: string | null;
  price_inr: number | null;
  product_url: string;
  category: string | null;
};

function StoresPage() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeBrand, setActiveBrand] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from("brands").select("*").order("name"),
        supabase.from("catalog_products").select("*").order("created_at", { ascending: false }),
      ]);
      setBrands((b as any) ?? []);
      setProducts((p as any) ?? []);
    })();
  }, []);

  const filtered = products.filter((p) => {
    const okBrand = activeBrand === "all" || p.brand_id === activeBrand;
    const okSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    return okBrand && okSearch;
  });

  const generate = async (productId: string) => {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    // Reuse existing slug if creator already generated one for this product
    const { data: existing } = await supabase
      .from("tracking_links")
      .select("slug")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();

    let slug = existing?.slug;
    if (!slug) {
      const { data, error } = await supabase
        .from("tracking_links")
        .insert({ user_id: user.id, product_id: productId })
        .select("slug")
        .single();
      if (error) return toast.error(error.message);
      slug = data.slug;
    }
    const fullUrl = `${window.location.origin}/r/${slug}`;
    await navigator.clipboard.writeText(fullUrl);
    toast.success("Tracking link copied!", { description: fullUrl });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-serif font-bold">Brand Stores</h1>
        <p className="text-muted-foreground mt-2">Pick a product, generate your tracking link, share it. Earn when someone buys.</p>

        <div className="flex flex-wrap gap-2 mt-6">
          <button
            onClick={() => setActiveBrand("all")}
            className={`px-4 py-2 rounded-full text-sm font-semibold border ${
              activeBrand === "all" ? "bg-deep-pink text-primary-foreground border-deep-pink" : "bg-card border-border hover:bg-accent"
            }`}
          >
            All
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBrand(b.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                activeBrand === b.id ? "bg-deep-pink text-primary-foreground border-deep-pink" : "bg-card border-border hover:bg-accent"
              }`}
            >
              {b.name} · {b.default_commission_rate}%
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full mt-4 px-4 py-3 rounded-lg border border-border bg-background"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {filtered.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-accent">
                {p.image_url && <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <p className="font-semibold line-clamp-2">{p.title}</p>
                {p.price_inr && <p className="text-sm text-muted-foreground mt-1">₹{p.price_inr}</p>}
                <button
                  onClick={() => generate(p.id)}
                  className="mt-auto pt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold text-deep-pink hover:underline"
                >
                  <LinkIcon size={14} /> Generate link <Copy size={14} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-12">No products match.</p>
          )}
        </div>
      </div>
    </div>
  );
}
