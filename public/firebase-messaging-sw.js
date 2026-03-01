// Firebase Messaging Service Worker
// This file is required for FCM background messages.
// It is served at /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// These values will be replaced during build/deployment
// In production, use environment-specific values
firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY || '__FIREBASE_API_KEY__',
  authDomain: self.FIREBASE_AUTH_DOMAIN || '__FIREBASE_AUTH_DOMAIN__',
  projectId: self.FIREBASE_PROJECT_ID || '__FIREBASE_PROJECT_ID__',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || '__FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '__FIREBASE_MESSAGING_SENDER_ID__',
  appId: self.FIREBASE_APP_ID || '__FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title = 'Folio', body = '' } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon: '/folio-pwa/pwa-192x192.png',
    badge: '/folio-pwa/pwa-192x192.png',
    tag: 'folio-task',
    data: payload.data,
  });
});
