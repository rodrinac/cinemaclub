// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCextIaU9Delu1x8aAQTis0MfdlEMV8awQ",
  authDomain: "cinema-club-5c65b.firebaseapp.com",
  projectId: "cinema-club-5c65b",
  storageBucket: "cinema-club-5c65b.firebasestorage.app",
  messagingSenderId: "121178376153",
  appId: "1:121178376153:web:0366ca8cab165b206e7bc8",
  measurementId: "G-T1BPJJ2QZ6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
