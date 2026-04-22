'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './PwaInstallPrompt.module.css';

/**
 * Extend the global Window/Event types for the `beforeinstallprompt` API,
 * which is Chrome/Edge-specific and not in standard TS lib types.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const STORAGE_KEY = 'worf-pwa-install-dismissed';
const SHOW_DELAY_MS = 30_000; // 30 sec delay to avoid being intrusive

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Don't show if user previously dismissed
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Delay showing the prompt so it doesn't appear immediately
      const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setDeferredPrompt(null);
    }, 300);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    handleClose();
  }, [handleClose]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        handleClose();
      }
    } catch {
      // User cancelled or error — silently handle
    }
  }, [deferredPrompt, handleClose]);

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      className={`${styles.banner} ${closing ? styles.bannerClosing : ''}`}
      role="alert"
      id="pwa-install-banner"
    >
      <div className={styles.iconWrap}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>

      <div className={styles.textWrap}>
        <p className={styles.title}>Telepítsd a WORF-ot!</p>
        <p className={styles.subtitle}>
          Alkalmazásként jobb élményt kapsz.
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.installBtn}
          onClick={handleInstall}
          id="pwa-install-btn"
        >
          Telepítés
        </button>
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={handleDismiss}
          id="pwa-dismiss-btn"
          aria-label="Elvetés"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
