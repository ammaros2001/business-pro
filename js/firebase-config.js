/**
 * إعدادات مشروع Firebase (قاعدة البيانات السحابية والتسجيل)
 * Firebase Configuration File
 */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAQxYsvWzvTvvySZPfSkfECT5VsmD3rnvQ",
  authDomain: "ammaros-project.firebaseapp.com",
  databaseURL: "https://ammaros-project-default-rtdb.firebaseio.com",
  projectId: "ammaros-project",
  storageBucket: "ammaros-project.firebasestorage.app",
  messagingSenderId: "880601259691",
  appId: "1:880601259691:web:562e12974569adccd461ee"
};

/**
 * الحصول على الإعدادات النشطة (الأولوية للإعدادات المحفوظة في النظام محلياً إن وُجدت)
 */
window.getActiveFirebaseConfig = function() {
  try {
    const saved = localStorage.getItem('mng_ecommerce_data_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.settings && parsed.settings.firebaseConfig && parsed.settings.firebaseConfig.apiKey) {
        return parsed.settings.firebaseConfig;
      }
    }
  } catch (e) {
    console.warn('Could not read saved firebaseConfig:', e);
  }

  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.apiKey.trim() !== "") {
    return window.FIREBASE_CONFIG;
  }

  return null;
};
