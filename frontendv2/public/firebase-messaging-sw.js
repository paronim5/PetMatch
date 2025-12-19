importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// TODO: Replace with your project's config object (same as in src/utils/firebase.ts)
const firebaseConfig = {

  apiKey: "AIzaSyA427uRv-fOZOafpXAcFe_oJSAhEOtIjr4",

  authDomain: "petmatch-bf4a0.firebaseapp.com",

  projectId: "petmatch-bf4a0",

  storageBucket: "petmatch-bf4a0.firebasestorage.app",

  messagingSenderId: "663612001434",

  appId: "1:663612001434:web:84a08d54da0d0b355ba323",

  measurementId: "G-RBZ0H9H0S6"

};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg',
    // data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
