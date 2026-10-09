// Lightweight Cookie Consent & Google Consent Mode v2 Handler (<3 KB)
declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

export function initConsent() {
  const banner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('cookie-accept');
  const rejectBtn = document.getElementById('cookie-reject');
  const settingsBtn = document.getElementById('cookie-settings-btn');

  // Initialize dataLayer and default Google Consent Mode v2
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: any[]) {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  const savedConsent = localStorage.getItem('user_cookie_consent');

  if (!savedConsent) {
    // Default denied
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
    if (banner) banner.classList.add('show');
  } else if (savedConsent === 'accepted') {
    applyAcceptedConsent();
  } else {
    // rejected
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
  }

  function applyAcceptedConsent() {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });

    // Load AdSense in idle period to eliminate impact on LCP/INP
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));
    idleCallback(() => {
      loadAdSenseScript();
    });
  }

  function loadAdSenseScript() {
    const clientId = document.documentElement.getAttribute('data-adsense-client');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isPlaceholder = !clientId || clientId.startsWith('ca-pub-00000000');

    if (isLocalhost || isPlaceholder || document.getElementById('adsense-script')) return;

    const script = document.createElement('script');
    script.id = 'adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
    document.head.appendChild(script);
  }

  acceptBtn?.addEventListener('click', () => {
    localStorage.setItem('user_cookie_consent', 'accepted');
    banner?.classList.remove('show');
    applyAcceptedConsent();
  });

  rejectBtn?.addEventListener('click', () => {
    localStorage.setItem('user_cookie_consent', 'rejected');
    banner?.classList.remove('show');
  });

  settingsBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    banner?.classList.add('show');
  });
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsent);
  } else {
    initConsent();
  }
}
