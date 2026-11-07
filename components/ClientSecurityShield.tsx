"use client";

import { useEffect } from "react";

/**
 * Détection du propriétaire / créateur (Kane Abdel / SuperAdmin / Localhost)
 * Si l'utilisateur est le propriétaire, TOUTES les restrictions sont levées :
 * - Clic droit autorisé
 * - Sélection et copie de texte autorisées
 * - F12 / DevTools autorisés
 * - Raccourcis clavier autorisés
 */
function isOwnerUser(): boolean {
  if (typeof window === "undefined") return false;

  try {
    // 1. Environnement de développement local
    const hostname = window.location.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost")
    ) {
      return true;
    }

    // 2. Détection paramètre d'URL secret (?owner=kaneabdel, ?bypass=kane, etc.)
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

    // 3. Clé persistante dans localStorage
    if (localStorage.getItem("demba_owner_unlocked") === "true") {
      return true;
    }

    // 4. Cookies de session administrateur / propriétaire
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

    // 5. Session Supabase dans localStorage (utilisateur connecté avec email kaneabdel ou rôle super_admin)
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
  } catch {
    // Erreurs d'accès au storage ignorées (navigation privée, etc.)
  }

  return false;
}

/**
 * Bouclier de Sécurité Global DembaSolution :
 * 1. Anti-Clickjacking & Frame-Busting (Protection contre l'encapsulation en iFrame pirate)
 * 2. Anti-Copie Universel (Interdiction de toute sélection, copie, couper, clic-droit et raccourcis d'inspection)
 * EXEMPTION TOTALE : Propriétaire (Kane Abdel) et SuperAdmin
 */
export function ClientSecurityShield() {
  useEffect(() => {
    // 1. Frame-Busting / Anti-Clickjacking
    if (typeof window !== "undefined") {
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = window.self.location.href;
        }
      } catch {
        window.location.href = "about:blank";
      }
    }

    // Raccourci secret propriétaire : Ctrl + Alt + K (ou Cmd + Alt + K) pour basculer le mode propriétaire n'importe où
    const handleOwnerToggle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "k" || e.key === "K")) {
        const current = localStorage.getItem("demba_owner_unlocked") === "true";
        if (current) {
          localStorage.removeItem("demba_owner_unlocked");
          alert("Mode Propriétaire DEMBA : DÉSACTIVÉ (Sécurité stricte active)");
        } else {
          localStorage.setItem("demba_owner_unlocked", "true");
          alert("Mode Propriétaire DEMBA : ACTIVÉ (Exemption complète accordée)");
        }
        window.location.reload();
      }
    };
    window.addEventListener("keydown", handleOwnerToggle);

    // Vérifier si l'utilisateur est exempté
    if (isOwnerUser()) {
      const existingStyle = document.getElementById("demba-anti-copy-shield");
      if (existingStyle) existingStyle.remove();
      return () => {
        window.removeEventListener("keydown", handleOwnerToggle);
      };
    }

    // 2. Injection du style global anti-copie / anti-sélection
    const styleId = "demba-anti-copy-shield";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        html, body, *:not(input):not(textarea):not([contenteditable="true"]) {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
        }
        input, textarea, [contenteditable="true"] {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
        img {
          -webkit-user-drag: none !important;
          user-drag: none !important;
          pointer-events: auto;
        }
      `;
      document.head.appendChild(style);
    }

    // 3. Interdiction du menu contextuel (clic droit) sauf dans les champs de saisie
    const handleContextMenu = (e: MouseEvent) => {
      if (isOwnerUser()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
      return false;
    };

    // 4. Interdiction de la copie et du couper
    const handleCopyCut = (e: ClipboardEvent) => {
      if (isOwnerUser()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.clearData();
      }
    };

    // 5. Interdiction du drag & drop
    const handleDragStart = (e: DragEvent) => {
      if (isOwnerUser()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
    };

    // 6. Blocage des raccourcis clavier de copie, inspection et impression
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOwnerUser()) return;
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + C ou X ou A hors des inputs
      if (isCtrlOrCmd && (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X" || e.key === "a" || e.key === "A") && !isInput) {
        e.preventDefault();
      }

      // Ctrl/Cmd + U (Code source), S (Enregistrer), P (Imprimer)
      if (isCtrlOrCmd && (e.key === "u" || e.key === "U" || e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")) {
        e.preventDefault();
      }

      // F12 ou Ctrl+Shift+I / J / C (DevTools)
      if (
        e.key === "F12" ||
        (isCtrlOrCmd && e.shiftKey && (e.key === "i" || e.key === "I" || e.key === "j" || e.key === "J" || e.key === "c" || e.key === "C"))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    document.addEventListener("copy", handleCopyCut, { capture: true });
    document.addEventListener("cut", handleCopyCut, { capture: true });
    document.addEventListener("dragstart", handleDragStart, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleOwnerToggle);
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("copy", handleCopyCut, { capture: true });
      document.removeEventListener("cut", handleCopyCut, { capture: true });
      document.removeEventListener("dragstart", handleDragStart, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  return null;
}

export default ClientSecurityShield;
