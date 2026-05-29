// ===== PWA SERVICE WORKER (Replace your existing SW block in index.js) =====

const SW_VERSION = '1.0.0';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker not supported');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] SW registered:', registration.scope);

        // Check for updates every 60 minutes
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Listen for new service worker waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available - show update prompt (optional)
              console.log('[PWA] New version available');
              // Uncomment to force refresh:
              // window.location.reload();
            }
          });
        });
      })
      .catch((err) => {
        console.error('[PWA] SW registration failed:', err);
      });
  });

  // Listen for messages from SW (e.g., cache updated)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_UPDATED') {
      console.log('[PWA] Content updated in background');
    }
  });
}

registerServiceWorker();

// ===== PWA INSTALL PROMPT =====
let deferredPrompt = null;
const installBanner = document.createElement('div');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show custom install banner (only on mobile)
  if (/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    showInstallBanner();
  }
});

function showInstallBanner() {
  installBanner.innerHTML = `
    <div id="pwa-install-banner" style="
      position: fixed;
      bottom: 80px;
      left: 16px;
      right: 16px;
      background: #1A130C;
      color: #FAF7F0;
      padding: 16px 20px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 100;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="/image/logo-192.png" alt="Buzz Cafe" style="width: 40px; height: 40px; border-radius: 10px;">
        <div>
          <p style="margin: 0; font-weight: 600;">Add Buzz Cafe to Home Screen</p>
          <p style="margin: 2px 0 0; opacity: 0.7; font-size: 12px;">Order faster with our app</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="pwa-dismiss" style="
          background: transparent;
          border: 1px solid rgba(250,247,240,0.3);
          color: #FAF7F0;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          cursor: pointer;
        ">Later</button>
        <button id="pwa-install" style="
          background: #C4A77D;
          border: none;
          color: #1A130C;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        ">Install</button>
      </div>
    </div>
  `;
  document.body.appendChild(installBanner);

  document.getElementById('pwa-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install');
    }
    deferredPrompt = null;
    installBanner.remove();
  });

  document.getElementById('pwa-dismiss').addEventListener('click', () => {
    installBanner.remove();
    localStorage.setItem('pwa-banner-dismissed', Date.now());
  });
}

// Hide banner if already installed
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed');
  deferredPrompt = null;
  if (installBanner.parentNode) installBanner.remove();
});

// Check if app is running in standalone mode
if (window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true) {
  console.log('[PWA] Running in standalone mode');
  document.body.classList.add('pwa-standalone');
}