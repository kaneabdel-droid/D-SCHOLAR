"use client";

import { useEffect } from "react";

/**
 * Bouclier de Sécurité Global DembaSolution :
 * 1. Anti-Clickjacking & Frame-Busting (Protection contre l'encapsulation en iFrame pirate)
 * 2. Anti-Copie Universel (Interdiction de toute sélection, copie, couper, clic-droit et raccourcis d'inspection)
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
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
      return false;
    };

    // 4. Interdiction de la copie et du couper
    const handleCopyCut = (e: ClipboardEvent) => {
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
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
    };

    // 6. Blocage des raccourcis clavier de copie, inspection et impression
    const handleKeyDown = (e: KeyboardEvent) => {
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
