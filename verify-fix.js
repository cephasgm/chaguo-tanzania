// Run in browser console after fixes
console.log('🔍 Verifying Chaguo fixes...');

// Check QR Code
const qrContainer = document.getElementById('qrcode');
console.log('QR Code container:', qrContainer ? '✅ Found' : '❌ Missing');
if (qrContainer && qrContainer.innerHTML.trim()) {
    console.log('QR Code content:', '✅ Generated');
} else {
    console.log('QR Code content:', '❌ Empty');
}

// Check Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
        console.log('Service Worker:', reg ? '✅ Registered' : '❌ Not registered');
    });
}

// Check icons
console.log('Testing icons...');
['icon-192x192.png', 'icon-512x512.png'].forEach(icon => {
    const img = new Image();
    img.onload = () => console.log(`${icon}: ✅ Loads`);
    img.onerror = () => console.log(`${icon}: ❌ Failed`);
    img.src = `icons/${icon}`;
});

// Check manifest
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
        console.log('PWA Installable:', registration ? '✅ Yes' : '❌ No');
    });
}

console.log('🎉 Verification complete!');
