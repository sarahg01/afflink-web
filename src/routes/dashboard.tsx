import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import { Trash2, Plus, Copy, Bell } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  instagram_handle: string | null;
  social_links: Record<string, string> | null;
  wallet_balance: number;
  lifetime_earnings: number;
};
type Post = { id: string; title: string; thumbnail_url: string | null; created_at: string };
type Order = {
  id: string;
  sale_amount: number;
  creator_earning: number;
  created_at: string;
  brands: { name: string } | null;
};
type Notif = { id: string; title: string; body: string | null; read: boolean; created_at: string };

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [stats, setStats] = useState({ totalClicks: 0, totalPosts: 0, salesCount: 0 });
  const [postbackToken, setPostbackToken] = useState<string>("");
  const [tab, setTab] = useState<"overview" | "posts" | "saved" | "new" | "wallet" | "profile">("overview");

  useEffect(() => {
    if (!authLoading && !user) router.navigate({ to: "/auth" });
  }, [user, authLoading, router]);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: ps }, { data: links }, { data: ords }, { data: ns }, { data: sec }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("posts").select("id, title, thumbnail_url, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("tracking_links").select("clicks").eq("user_id", user.id),
      supabase.from("orders").select("id, sale_amount, creator_earning, created_at, brands(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("creator_secrets").select("postback_token").eq("user_id", user.id).maybeSingle(),
    ]);
    setProfile(p as any);
    setPosts((ps as any) ?? []);
    setOrders((ords as any) ?? []);
    setNotifs((ns as any) ?? []);
    setPostbackToken((sec as any)?.postback_token ?? "");
    const totalClicks = (links ?? []).reduce((s: number, l: any) => s + (l.clicks ?? 0), 0);
    setStats({ totalClicks, totalPosts: ps?.length ?? 0, salesCount: ords?.length ?? 0 });
  };

  useEffect(() => { load(); }, [user]);

  // Live notifications
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dash-notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setNotifs((cur) => [n, ...cur].slice(0, 20));
          toast.success(n.title, { description: n.body ?? undefined });
          load();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (authLoading || !user || !profile) return <div className="min-h-screen"><Header /><p className="p-12 text-center text-muted-foreground">Loading…</p></div>;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-serif font-bold">Hey, {profile.display_name ?? "creator"} ✨</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: "Posts", value: stats.totalPosts },
            { label: "Total Clicks", value: stats.totalClicks },
            { label: "Sales", value: stats.salesCount },
            { label: "Wallet (₹)", value: Number(profile.wallet_balance).toFixed(2) },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-serif font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-8 border-b border-border overflow-x-auto">
          {(["overview", "posts", "saved", "new", "wallet", "profile"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 -mb-px whitespace-nowrap ${
                tab === t ? "border-deep-pink text-deep-pink" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "new" ? "+ New post" : t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "overview" && <OverviewTab orders={orders} notifs={notifs} onSeen={load} />}
          {tab === "posts" && <PostsTab posts={posts} onChange={load} />}
          {tab === "saved" && <SavedTab userId={user.id} />}
          {tab === "new" && <NewPostTab userId={user.id} onCreated={() => { setTab("posts"); load(); }} />}
          {tab === "wallet" && <WalletTab profile={profile} postbackToken={postbackToken} onChange={load} />}
          {tab === "profile" && <ProfileTab profile={profile} onSaved={load} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ orders, notifs, onSeen }: { orders: Order[]; notifs: Notif[]; onSeen: () => void }) {
  const markRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    onSeen();
  };
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-serif text-xl font-bold mb-3">Recent Sales</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales yet. Share your tracking links!</p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((o) => (
              <li key={o.id} className="py-2 flex justify-between text-sm">
                <span>
                  <span className="font-semibold">{o.brands?.name ?? "Sale"}</span>
                  <span className="text-muted-foreground"> · ₹{Number(o.sale_amount).toFixed(0)}</span>
                </span>
                <span className="font-semibold text-deep-pink">+₹{Number(o.creator_earning).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-xl font-bold flex items-center gap-2"><Bell size={18} /> Notifications</h3>
          {notifs.some((n) => !n.read) && (
            <button onClick={markRead} className="text-xs text-deep-pink font-semibold">Mark all read</button>
          )}
        </div>
        {notifs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications.</p>
        ) : (
          <ul className="space-y-2">
            {notifs.map((n) => (
              <li key={n.id} className={`p-3 rounded-lg text-sm ${n.read ? "bg-muted" : "bg-accent"}`}>
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function WalletTab({ profile, postbackToken, onChange }: { profile: Profile; postbackToken: string; onChange: () => void }) {
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [loading, setLoading] = useState(false);
  const [redemptions, setRedemptions] = useState<any[]>([]);

  const reload = async () => {
    const { data } = await supabase.from("redemptions").select("*").order("requested_at", { ascending: false });
    setRedemptions(data ?? []);
  };
  useEffect(() => { reload(); }, []);

  const balance = Number(profile.wallet_balance);
  const canRedeem = balance >= 50;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (amt < 50) return toast.error("Minimum redeem is ₹50");
    if (amt > balance) return toast.error("Amount exceeds balance");
    if (!upi.trim()) return toast.error("Enter your UPI / bank details");
    setLoading(true);
    const { error } = await supabase.rpc("request_redeem", { _amount: amt, _upi: upi });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Redeem requested! We'll process it soon.");
    setAmount(""); setUpi("");
    onChange(); reload();
  };

  const postbackUrl = postbackToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/postback?token=${postbackToken}&sub_id={SUB_ID}&amount={SALE_AMOUNT}&order_id={ORDER_ID}`
    : "";

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-deep-pink to-rose text-primary-foreground rounded-2xl p-6">
        <p className="text-sm opacity-80 uppercase tracking-wider">AffLink Wallet</p>
        <p className="text-4xl font-serif font-bold mt-1">₹{balance.toFixed(2)}</p>
        <p className="text-sm opacity-80 mt-2">Lifetime earnings: ₹{Number(profile.lifetime_earnings).toFixed(2)}</p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-serif text-xl font-bold">Redeem</h3>
        <p className="text-xs text-muted-foreground">Minimum ₹50. Payouts processed manually within 3 business days.</p>
        <input type="number" min={50} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
               placeholder="Amount (₹)" className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
        <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="UPI ID or bank account"
               className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
        <button disabled={loading || !canRedeem} className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold disabled:opacity-50">
          {!canRedeem ? `Need ₹${(50 - balance).toFixed(2)} more to redeem` : loading ? "Requesting…" : "Request payout"}
        </button>
      </form>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-serif text-xl font-bold mb-3">Redemption history</h3>
        {redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {redemptions.map((r) => (
              <li key={r.id} className="py-2 flex justify-between text-sm">
                <span>₹{Number(r.amount).toFixed(2)} · <span className="text-muted-foreground">{r.upi_or_bank}</span></span>
                <span className={`font-semibold ${r.status === "paid" ? "text-green-600" : r.status === "rejected" ? "text-destructive" : "text-deep-pink"}`}>
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-serif text-xl font-bold mb-2">Your postback URL</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Configure this URL inside your Amazon / Myntra / Meesho affiliate dashboard so sales auto-credit your wallet. Replace <code>{"{...}"}</code> placeholders with the merchant's macros.
        </p>
        <div className="flex gap-2">
          <input readOnly value={postbackUrl} className="flex-1 px-3 py-2 text-xs rounded-md border border-border bg-background font-mono" />
          <button onClick={() => { navigator.clipboard.writeText(postbackUrl); toast.success("Copied"); }}
                  className="px-3 rounded-md border border-border hover:bg-accent"><Copy size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function PostsTab({ posts, onChange }: { posts: Post[]; onChange: () => void }) {
  const del = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChange();
  };
  if (posts.length === 0) return <p className="text-muted-foreground">No posts yet. Create your first!</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => (
        <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
          <Link to="/post/$postId" params={{ postId: p.id }} className="block aspect-[4/3] bg-gradient-to-br from-accent to-rose">
            {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />}
          </Link>
          <div className="p-3 flex items-center justify-between">
            <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
            <button onClick={() => del(p.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewPostTab({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [niche, setNiche] = useState("");
  const [thumb, setThumb] = useState<File | null>(null);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let thumbnail_url: string | null = null;
      if (thumb) {
        const path = `${userId}/${Date.now()}-${thumb.name}`;
        const { error: upErr } = await supabase.storage.from("thumbnails").upload(path, thumb);
        if (upErr) throw upErr;
        thumbnail_url = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      }
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ user_id: userId, title, description, thumbnail_url, niche: niche || null })
        .select().single();
      if (error) throw error;

      const valid = links.filter((l) => l.label && l.url);
      if (valid.length) {
        const { error: lErr } = await supabase.from("affiliate_links").insert(
          valid.map((l, i) => ({ post_id: post.id, user_id: userId, label: l.label, url: l.url, position: i }))
        );
        if (lErr) throw lErr;
      }
      toast.success("Post published!");
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Tip: paste your affiliate tracking URL as the link URL so sales credit your wallet.
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" required
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description / review"
                rows={4} className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <select value={niche} onChange={(e) => setNiche(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background">
        <option value="">Select a niche (optional)</option>
        {["beauty", "tech", "fashion", "home", "fitness", "food"].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <div>
        <label className="block text-sm font-semibold mb-1">Thumbnail</label>
        <input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Affiliate Links</label>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={l.label} onChange={(e) => { const c = [...links]; c[i].label = e.target.value; setLinks(c); }}
                   placeholder="Label (e.g. Buy on Amazon)"
                   className="flex-1 px-3 py-2 rounded-md border border-border bg-background" />
            <input value={l.url} onChange={(e) => { const c = [...links]; c[i].url = e.target.value; setLinks(c); }}
                   placeholder="https://..." type="url"
                   className="flex-1 px-3 py-2 rounded-md border border-border bg-background" />
            <button type="button" onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                    className="px-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])}
                className="text-sm text-deep-pink font-semibold flex items-center gap-1">
          <Plus size={14} /> Add link
        </button>
      </div>

      <button disabled={saving} className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold disabled:opacity-50">
        {saving ? "Publishing…" : "Publish post"}
      </button>
    </form>
  );
}

function ProfileTab({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [insta, setInsta] = useState(profile.instagram_handle ?? "");
  const [yt, setYt] = useState(profile.social_links?.youtube ?? "");
  const [x, setX] = useState(profile.social_links?.x ?? "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let avatar_url = profile.avatar_url;
      if (avatar) {
        const path = `${profile.id}/${Date.now()}-${avatar.name}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true });
        if (upErr) throw upErr;
        avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").update({
        display_name: displayName,
        bio,
        instagram_handle: insta,
        social_links: { youtube: yt, x: x },
        avatar_url,
      }).eq("id", profile.id);
      if (error) throw error;
      toast.success("Profile updated");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-4">
        {profile.avatar_url && <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />}
        <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
      </div>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" rows={3}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <input value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="Instagram handle (without @)"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <input value={yt} onChange={(e) => setYt(e.target.value)} placeholder="YouTube URL"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <input value={x} onChange={(e) => setX(e.target.value)} placeholder="X (Twitter) URL"
             className="w-full px-4 py-3 rounded-lg border border-border bg-background" />
      <button disabled={saving} className="px-6 py-3 rounded-lg bg-deep-pink text-primary-foreground font-semibold disabled:opacity-50">
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

function SavedTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("saves")
        .select("post_id, posts(id, title, thumbnail_url, profiles(display_name))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setItems((data as any) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  const remove = async (postId: string) => {
    await supabase.from("saves").delete().eq("user_id", userId).eq("post_id", postId);
    setItems((cur) => cur.filter((i) => i.post_id !== postId));
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (items.length === 0) return <p className="text-muted-foreground">Nothing saved yet. Tap the bookmark on any review to save it.</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((it) => (
        <div key={it.post_id} className="bg-card border border-border rounded-xl overflow-hidden">
          <Link to="/post/$postId" params={{ postId: it.post_id }} className="block aspect-[4/3] bg-gradient-to-br from-accent to-rose">
            {it.posts?.thumbnail_url && <img src={it.posts.thumbnail_url} alt="" className="w-full h-full object-cover" />}
          </Link>
          <div className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm line-clamp-1">{it.posts?.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">by {it.posts?.profiles?.display_name ?? "creator"}</p>
            </div>
            <button onClick={() => remove(it.post_id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
