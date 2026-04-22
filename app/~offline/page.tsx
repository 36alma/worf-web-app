'use client';

import styles from './OfflinePage.module.css';

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className={styles.page}>
      {/* Background effects */}
      <div className={styles.background}>
        <div className={styles.glow} />
        <div className={styles.grid} />
      </div>

      <div className={styles.content}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <span className={styles.logoText}>WORF</span>
        </div>

        {/* Wifi off icon */}
        <div className={styles.iconWrap}>
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.wifiIcon}
          >
            <path d="M12 20h.01" />
            <path d="M8.5 16.429a5 5 0 0 1 7 0" />
            <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
            <path d="M13.83 10.17A10 10 0 0 1 19 12.859" />
            <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
            <path d="M10.66 6.005A15 15 0 0 1 22 8.82" />
            <line x1="2" y1="2" x2="22" y2="22" className={styles.crossLine} />
          </svg>
        </div>

        {/* Text */}
        <h1 className={styles.title}>Nincs internetkapcsolat</h1>
        <p className={styles.message}>
          A WORF használatához aktív hálózati kapcsolat szükséges.
          <br />
          Kérlek, ellenőrizd az internetkapcsolatod, majd próbáld újra.
        </p>

        <div className={styles.divider} />

        {/* Refresh button */}
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
          id="offline-refresh-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          Újrapróbálkozás
        </button>

        <p className={styles.helpText}>
          Ha a probléma továbbra is fennáll, keresd a{' '}
          <a href="mailto:support@worf.app" className={styles.helpLink}>
            support@worf.app
          </a>{' '}
          csapatot.
        </p>
      </div>
    </div>
  );
}
