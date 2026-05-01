import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Instagram, ExternalLink, X } from "lucide-react";

export const Route = createFileRoute("/post/$postId")({
  component: PostPage,
});

type Post = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    instagram_handle: string | null;
    social_links: Record<string, string> | null;
  } | null;
};

type AffLink = { id: string; label: string; url: string };

function PostPage() {
  const { postId } = Route.useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [links, setLinks] = useState<AffLink[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: l }] = await Promise.all([
        supabase.from("posts")
          .select("id, title, description, thumbnail_url, user_id, profiles(display_name, avatar_url, bio, instagram_handle, social_links)")
          .eq("id", postId).maybeSingle(),
        supabase.from("affiliate_links")
          .select("id, label, url").eq("post_id", postId).order("position"),
      ]);
      setPost(p as any);
      setLinks((l as any) ?? []);
      setLoading(false);
    })();
  }, [postId]);

  const trackClick = async (id: string, url: string) => {
    await supabase.rpc("increment_link_click", { link_id: id });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) return <div className="min-h-screen"><Header /><p className="p-12 text-center text-muted-foreground">Loading…</p></div>;
  if (!post) return <div className="min-h-screen"><Header /><p className="p-12 text-center">Post not found</p></div>;

  const insta = post.profiles?.instagram_handle?.replace("@", "");
  const socials = post.profiles?.social_links ?? {};

  return (
    <div className="min-h-screen">
      <Header />
      <article className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>

        <div className="mt-4 aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br from-accent to-rose flex items-center justify-center text-7xl">
          {post.thumbnail_url ? (
            <img src={post.thumbnail_url} alt={post.title} className="w-full h-full object-cover" />
          ) : "🌸"}
        </div>

        <h1 className="mt-6 text-4xl font-serif font-bold">{post.title}</h1>

        <div className="mt-4 flex items-center gap-3">
          {post.profiles?.avatar_url && (
            <img src={post.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          )}
          <div>
            <p className="font-semibold text-sm">{post.profiles?.display_name}</p>
            {post.profiles?.bio && <p className="text-xs text-muted-foreground">{post.profiles.bio}</p>}
          </div>
        </div>

        {post.description && (
          <p className="mt-6 text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.description}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => setOpen(true)}
            className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold hover:opacity-90"
          >
            View Links & Socials
          </button>
          {insta && (
            <a
              href={`https://instagram.com/${insta}`}
              target="_blank" rel="noopener noreferrer"
              className="px-6 py-3 rounded-lg border-2 border-deep-pink text-deep-pink font-semibold hover:bg-deep-pink hover:text-primary-foreground transition flex items-center gap-2"
            >
              <Instagram size={18} /> Contact on Instagram
            </a>
          )}
        </div>
      </article>

      {/* Popup */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
            <h3 className="font-serif text-2xl font-bold mb-1">Links from {post.profiles?.display_name}</h3>
            <p className="text-sm text-muted-foreground mb-5">Tap to shop or follow ✨</p>

            {links.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Featured</p>
                {links.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => trackClick(l.id, l.url)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-accent hover:bg-rose hover:text-primary-foreground transition text-left font-medium"
                  >
                    <span>{l.label}</span>
                    <ExternalLink size={16} />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Socials</p>
              {insta && (
                <a href={`https://instagram.com/${insta}`} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent hover:bg-rose hover:text-primary-foreground transition">
                  <Instagram size={18} /> @{insta}
                </a>
              )}
              {Object.entries(socials).filter(([, v]) => v).map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noopener noreferrer"
                   className="flex items-center justify-between px-4 py-3 rounded-lg bg-accent hover:bg-rose hover:text-primary-foreground transition capitalize">
                  <span>{k}</span><ExternalLink size={14} />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
