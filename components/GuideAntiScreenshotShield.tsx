"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

function isOwnerUser(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const hostname = window.location.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost")
    ) {
      return true;
    }

    const search = window.location.search;
    if (
      search.includes("owner=kaneabdel") ||
      search.includes("admin=kaneabdel") ||
      search.includes("bypass=kane") ||
      search.includes("demba_owner=1")
    ) {
      try {
        localStorage.setItem("demba_owner_unlocked", "true");
      } catch {}
      return true;
    }

    if (localStorage.getItem("demba_owner_unlocked") === "true") {
      return true;
    }

    const cookies = document.cookie || "";
    if (
      cookies.includes("kaneabdel") ||
      cookies.includes("admin_session") ||
      cookies.includes("super_admin") ||
      cookies.includes("d_sante_admin") ||
      cookies.includes("d_hotel_admin")
    ) {
      return true;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase.auth.token") || key.includes("auth-token") || key.includes("sb-"))) {
        const val = localStorage.getItem(key) || "";
        if (
          val.includes("kaneabdel") ||
          val.includes("super_admin") ||
          val.includes("superadmin")
        ) {
          return true;
        }
      }
    }
  } catch {}

  return false;
}

/**
 * Bouclier Anti-Capture d'Écran pour les Guides Officiels DembaSolution :
 * - Masquage instantané en cas de perte de focus / déclenchement d'outil de capture (Snipping Tool, etc.)
 * - Neutralisation de la touche Impr. Écran (PrintScreen) et vidage du presse-papier
 * - Blocage total de l'impression et de l'export PDF (@media print)
 * EXEMPTION TOTALE : Propriétaire (Kane Abdel) et SuperAdmin
 */
export function GuideAntiScreenshotShield() {
  const [isProtected, setIsProtected] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    // Vérifier si propriétaire dès le montage
    if (isOwnerUser()) {
      setIsOwner(true);
      return;
    }

    // 1. Détection de la touche Impr. Écran (PrintScreen)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isOwnerUser()) return;
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
        setIsProtected(true);
      }
    };

    // 2. Détection d'activation d'outils de capture externes (perte de focus de la fenêtre)
    const handleBlur = () => {
      if (isOwnerUser()) return;
      setIsProtected(true);
    };

    const handleFocus = () => {
      setIsProtected(false);
    };

    const handleVisibilityChange = () => {
      if (isOwnerUser()) return;
      if (document.hidden) {
        setIsProtected(true);
      } else {
        setIsProtected(false);
      }
    };

    // 3. Style d'impression (@media print) pour bloquer les captures par impression/PDF
    const printStyleId = "guide-anti-print-shield";
    if (!document.getElementById(printStyleId)) {
      const style = document.createElement("style");
      style.id = printStyleId;
      style.innerHTML = `
        @media print {
          html, body {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (isOwner || !isProtected) {
    return null;
  }

  return (
    <div
      onClick={() => setIsProtected(false)}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 text-white p-6 text-center select-none backdrop-blur-2xl cursor-pointer"
    >
      <div className="max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-9 h-9 animate-pulse" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-white uppercase">
          Contenu Protégé • Capture d&apos;Écran Restreinte
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Conformément au plan de sécurité DembaSolution, la capture, copie et reproduction des guides méthodologiques sont strictement interdites.
        </p>
        <div className="pt-2">
          <span className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-emerald-400 text-xs font-bold border border-slate-700">
            Cliquez sur l&apos;écran pour reprendre la lecture
          </span>
        </div>
      </div>
    </div>
  );
}

export default GuideAntiScreenshotShield;
