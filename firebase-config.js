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
let app;
try {
    app = firebase.initializeApp(firebaseConfig);
} catch (error) {
    if (error.code === 'app/duplicate-app') {
        app = firebase.app();
    } else {
        console.error('خطأ في تهيئة Firebase:', error);
        throw error;
    }
}

// تهيئة Firestore
const db = app.firestore();

// إعدادات Firestore
db.settings({
    timestampsInSnapshots: true,  // لمعالجة الطوابع الزمنية بشكل صحيح
    cacheSizeBytes: 5242880,      // 5MB حجم التخزين المؤقت
    ignoreUndefinedProperties: true, // تجاهل الخصائص غير المعرفة
    merge: true // إضافة خيار الدمج
});

// تهيئة Authentication
const auth = app.auth();

// إعدادات المصادقة
auth.useDeviceLanguage();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('تم تعيين مستوى الاستمرارية بنجاح');
    })
    .catch((error) => {
        console.error('خطأ في تعيين مستوى الاستمرارية:', error);
    });

// تصدير الكائنات للاستخدام العالمي
window.db = db;
window.auth = auth;
window.firebase = firebase;

// التحقق من اتصال Firebase
db.enableNetwork()
    .then(() => {
        console.log('تم الاتصال بـ Firebase بنجاح');
    })
    .catch((error) => {
        console.error('خطأ في الاتصال بـ Firebase:', error);
    });

// إضافة مستمع لحالة المصادقة
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('المستخدم مسجل الدخول:', user.email);
    } else {
        console.log('المستخدم غير مسجل الدخول');
    }
}); 
