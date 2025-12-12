// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// 1. IMPORT THÊM DÒNG NÀY ĐỂ DÙNG THỐNG KÊ
import { getAnalytics, isSupported } from "firebase/analytics"; 

const firebaseConfig = {
  apiKey: "AIzaSyBB8qyd_u7Yd1Nql3u-3tJ02Ohm1bbtT6Y",
  authDomain: "mathgenius-thu18.firebaseapp.com",
  projectId: "mathgenius-thu18",
  storageBucket: "mathgenius-thu18.firebasestorage.app",
  messagingSenderId: "96381399270",
  appId: "1:96381399270:web:328c841027ddc2c77a4b27",
  measurementId: "G-66F83H5226"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// 2. KHỞI TẠO ANALYTICS (CÓ KIỂM TRA MÔI TRƯỜNG ĐỂ TRÁNH LỖI)
// Chúng ta dùng isSupported() để đảm bảo code không bị lỗi nếu chạy trên môi trường không hỗ trợ
export const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);