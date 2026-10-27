// Fake Firebase SDK for the browser tests (served instead of www.gstatic.com/firebasejs/…).
export function initializeApp(config) { return { name: '[DEFAULT]', options: config }; }
