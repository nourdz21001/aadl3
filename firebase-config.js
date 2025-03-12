// تكوين Firebase
// قم بنسخ هذه القيم من لوحة تحكم Firebase الخاصة بك
const firebaseConfig = {
    apiKey: "AIzaSyAnT_rFUGxKej8-lVd08sKufj51xIQqHEw",
    authDomain: "aadl3-3c556.firebaseapp.com",
    projectId: "aadl3-3c556",
    storageBucket: "aadl3-3c556.firebasestorage.app",
    messagingSenderId: "670216346838",
    appId: "1:670216346838:web:2865e93afc814b75cd3d77",
    measurementId: "G-BRBLGKNXKY"         // معرف التطبيق
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);

// الحصول على مرجع قاعدة البيانات
const db = firebase.firestore();

// إعدادات Firestore
db.settings({
    timestampsInSnapshots: true,  // لمعالجة الطوابع الزمنية بشكل صحيح
    cacheSizeBytes: 5242880,      // 5MB حجم التخزين المؤقت
    ignoreUndefinedProperties: true // تجاهل الخصائص غير المعرفة
});

// تصدير كائن قاعدة البيانات للاستخدام في الملفات الأخرى
window.db = db;

// التحقق من اتصال Firebase
db.enableNetwork().then(() => {
    console.log('تم الاتصال بـ Firebase بنجاح');
}).catch((error) => {
    console.error('خطأ في الاتصال بـ Firebase:', error);
}); 