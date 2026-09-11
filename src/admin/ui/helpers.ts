/* =============================================================================
   ui/helpers — the small functions every view shares. No React in here.
   ========================================================================== */
import config from "../../config";

/* THE FACE'S COLOUR IS DERIVED FROM THE NAME, so the same person is the same
   colour on every screen — never picked per render. Eight buckets on the
   badge palette (every hue means nothing, by contract: an avatar identifies,
   it never judges). djb2 with a murmur finaliser so anagrams and same-length
   names do not land on one colour. */
export const AVATAR_TONES = ["gray", "blue", "indigo", "purple", "pink", "orange", "sky", "slate"] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

export function avatarTone(name?: string | null): AvatarTone {
    const s = String(name || "");
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return AVATAR_TONES[(h >>> 0) % AVATAR_TONES.length];
}

export function initials(name?: string | null) {
    /* Split on any separator a name actually arrives with, not just spaces:
       usernames come through as `Jaswant_Kaul` and `priya.nair`. */
    const p = String(name || "")
        .trim()
        .split(/[\s._-]+/)
        .filter(Boolean);
    return ((p[0] || "")[0] || "").toUpperCase() + ((p[1] || "")[0] || "").toUpperCase();
}

export function qs(obj: Record<string, string | number | null | undefined>) {
    const p: string[] = [];
    for (const k in obj) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") p.push(k + "=" + encodeURIComponent(String(obj[k])));
    return p.length ? "?" + p.join("&") : "";
}

export function cap(s?: string | null) {
    return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
}

/** `new-lead` → "New Lead". */
export const titleise = (k: string) =>
    String(k || "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

/* Hand a link to the user in whatever way the browser supports: the OS share
   sheet where there is one, the clipboard otherwise. Returns the line to
   toast, or null when there is nothing to say. */
export async function shareOrCopy(url: string, title: string): Promise<string | null> {
    if (navigator.share) {
        try {
            await navigator.share({ title, url });
            return null;
        } catch (e) {
            if ((e as { name?: string }).name === "AbortError") return null;
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        return "Link copied to the clipboard.";
    } catch {
        return "Could not copy automatically — select the link below.";
    }
}

/* Copy, and only copy — no share sheet. `input` is the on-screen field holding
   the same text, for the legacy command on an insecure origin. */
export async function copyToClipboard(text: string, input?: HTMLInputElement | null): Promise<string> {
    try {
        await navigator.clipboard.writeText(text);
        return "Copied.";
    } catch {
        /* insecure origin, or a permissions policy that refuses — fall through */
    }
    if (input) {
        input.focus();
        input.select();
        try {
            if (document.execCommand("copy")) return "Copied.";
        } catch {
            /* fall through to the manual instruction */
        }
        return "Press Ctrl+C — the link is selected.";
    }
    return "Could not copy — select the link and copy it.";
}

/* A customer-facing document link, absolute against DJANGO's origin (the public
   document views are mounted at the site root, outside /api). */
export function publicDocUrl(path: string): string {
    try {
        return new URL(path, new URL(config.BASE_URL).origin).href;
    } catch {
        return new URL(path, location.origin).href;
    }
}

/* Print a server-rendered document sheet without leaving the page. Same
   sandbox as DocPage: same-origin so the frame can be driven, modals so
   print() is allowed, no scripts. */
export function printHtml(html: string, title: string) {
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.setAttribute("sandbox", "allow-same-origin allow-modals");
    f.title = title;
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.srcdoc = html;
    f.onload = () => {
        const w = f.contentWindow;
        if (!w) {
            f.remove();
            return;
        }
        w.focus();
        w.print();
        window.setTimeout(() => f.remove(), 1000);
    };
    document.body.appendChild(f);
}
