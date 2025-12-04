// PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('SW registered:', registration);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('SW update found:', newWorker);
            });
        })
        .catch(error => {
            console.log('SW registration failed:', error);
        });
}

// PWA Installation
let deferredPrompt;
const installButton = document.getElementById('install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (installButton) {
        installButton.style.display = 'block';
        
        installButton.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('PWA installed');
                installButton.style.display = 'none';
            }
            
            deferredPrompt = null;
        });
    }
});

// Check if app is installed
window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    if (installButton) installButton.style.display = 'none';
    
    // Track installation
    if (window.ga) {
        ga('send', 'event', 'PWA', 'installed');
    }
});

// Detect if running as PWA
function isRunningAsPWA() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
}

// Offline detection
window.addEventListener('online', () => {
    if (window.chaguoApp) {
        chaguoApp.updateStatus('Back online', 'success');
        chaguoApp.showToast('Internet connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    if (window.chaguoApp) {
        chaguoApp.updateStatus('Offline mode', 'warning');
        chaguoApp.showToast('No internet connection. Using cached data.', 'warning');
    }
});

// Background Sync
if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
        // Register for background sync
        registration.sync.register('sync-configs')
            .then(() => console.log('Background sync registered'))
            .catch(error => console.log('Background sync failed:', error));
    });
}

// Periodic Sync (for updates)
if ('serviceWorker' in navigator && 'PeriodicSyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
        registration.periodicSync.register('update-configs', {
            minInterval: 24 * 60 * 60 * 1000 // 24 hours
        }).then(() => console.log('Periodic sync registered'));
    });
}
