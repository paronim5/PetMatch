// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { userService } from "../services/user";

// Your web app's Firebase configuration
// TODO: Replace with your project's config object
const firebaseConfig = {

  apiKey: "AIzaSyA427uRv-fOZOafpXAcFe_oJSAhEOtIjr4",

  authDomain: "petmatch-bf4a0.firebaseapp.com",

  projectId: "petmatch-bf4a0",

  storageBucket: "petmatch-bf4a0.firebasestorage.app",

  messagingSenderId: "663612001434",

  appId: "1:663612001434:web:84a08d54da0d0b355ba323",

  measurementId: "G-RBZ0H9H0S6"

};

let messaging: ReturnType<typeof getMessaging> | null = null;

try {
  const app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (error) {
  console.warn("Firebase not initialized (missing config?)", error);
}

export const requestForToken = async () => {
  if (!messaging) return;
  
  try {
    const currentToken = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
    if (currentToken) {
      console.log('current token for client: ', currentToken);
      // Register token with backend
      await userService.registerPushToken(currentToken);
    } else {
      console.log('No registration token available. Request permission to generate one.');
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
