// المتغيرات العامة
let currentData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 10;

// تعريف الحقول
const FIELD_KEYS = {
    NIN: 'nin',
    NAME_AR: 'fatherNameAr',
    NAME_FR: 'fatherNameFr',
    PHONE: 'phone',
    TIMESTAMP: 'timestamp',
    STATUS: 'status',
    NOTES: 'notes'
};

// بيانات المسؤول
const ADMIN_CREDENTIALS = {
    email: 'admin@aadl.dz',
    password: 'Admin@2024'
};

// التحقق من وجود حساب المسؤول وإنشائه إذا لم يكن موجوداً
async function ensureAdminExists() {
    try {
        // Try to sign in first to check if account exists
        try {
            await auth.signInWithEmailAndPassword(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
            console.log('تم تسجيل الدخول بنجاح كمسؤول');
            return await handleExistingAuthAccount();
        } catch (error) {
            // If account doesn't exist, create it
            if (error.code === 'auth/user-not-found') {
                const userCredential = await auth.createUserWithEmailAndPassword(
                    ADMIN_CREDENTIALS.email,
                    ADMIN_CREDENTIALS.password
                );
                console.log('تم إنشاء حساب المسؤول بنجاح');
                return await handleExistingAuthAccount();
            } else {
                throw error; // Re-throw other errors
            }
        }
    } catch (error) {
        console.error('خطأ في إنشاء/تسجيل دخول المسؤول:', error);
        if (error.code === 'auth/email-already-in-use') {
            // If we get here, the account exists but password might be wrong
            showError('خطأ في تسجيل الدخول: تأكد من صحة كلمة المرور');
        } else {
            showError(error.message || 'حدث خطأ غير متوقع');
        }
        return false;
    }
}

async function handleExistingAuthAccount() {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('لم يتم العثور على معلومات المستخدم');
        }

        // Check if admin document exists in Firestore
        const adminDoc = await db.collection('users').doc(user.uid).get();
        
        if (!adminDoc.exists) {
            // Create admin document if it doesn't exist
            await db.collection('users').doc(user.uid).set({
                email: ADMIN_CREDENTIALS.email,
                role: 'admin',
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('تم إضافة معلومات المسؤول إلى Firestore');
        } else {
            // Update last login
            await db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('تم تحديث آخر تسجيل دخول للمسؤول');
        }
        return true;
    } catch (error) {
        console.error('خطأ في معالجة حساب المسؤول:', error);
        return false;
    }
}

// تحديث دالة handleLogin
async function handleLogin(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'جاري تسجيل الدخول...';
        
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;

        console.log('محاولة تسجيل الدخول باستخدام:', email);

        // تسجيل الدخول باستخدام Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('تم تسجيل الدخول بنجاح:', user.email);

        // إذا كان البريد الإلكتروني هو بريد المسؤول
        if (email === ADMIN_CREDENTIALS.email) {
            try {
                // التحقق من وجود وثيقة المستخدم في Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    console.log('إنشاء وثيقة المسؤول في Firestore...');
                    // إنشاء وثيقة المستخدم في Firestore
                    await db.collection('users').doc(user.uid).set({
                        email: user.email,
                        role: 'admin',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    console.log('تحديث وقت آخر تسجيل دخول للمسؤول...');
                    // تحديث وقت آخر تسجيل دخول
                    await db.collection('users').doc(user.uid).update({
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                // تخزين حالة تسجيل الدخول
                sessionStorage.setItem('adminLoggedIn', 'true');
                location.reload();
                return;
            } catch (firestoreError) {
                console.error('خطأ في التعامل مع Firestore:', firestoreError);
                throw new Error('حدث خطأ أثناء معالجة بيانات المستخدم');
            }
        }

        // للمستخدمين الآخرين، التحقق من دورهم
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                console.log('لم يتم العثور على وثيقة المستخدم في Firestore');
                await auth.signOut();
                throw new Error('لم يتم العثور على بيانات المستخدم في Firestore');
            }

            const userData = userDoc.data();
            if (userData.role !== 'admin') {
                console.log('المستخدم ليس لديه صلاحيات المسؤول');
                await auth.signOut();
                throw new Error('ليس لديك صلاحية الوصول إلى لوحة التحكم');
            }

            // تحديث آخر تسجيل دخول
            await db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            sessionStorage.setItem('adminLoggedIn', 'true');
            location.reload();

        } catch (firestoreError) {
            console.error('خطأ في التحقق من صلاحيات المستخدم:', firestoreError);
            await auth.signOut();
            throw new Error('حدث خطأ في التحقق من صلاحيات المستخدم');
        }

    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';

        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
            case 'auth/user-disabled':
                errorMessage = 'تم تعطيل هذا الحساب';
                break;
            case 'auth/user-not-found':
                errorMessage = 'لم يتم العثور على المستخدم';
                break;
            case 'auth/wrong-password':
                errorMessage = 'كلمة المرور غير صحيحة';
                break;
            case 'auth/invalid-login-credentials':
                errorMessage = 'بيانات تسجيل الدخول غير صحيحة';
                break;
        }

        alert(errorMessage);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// تحديث دالة التهيئة
document.addEventListener('DOMContentLoaded', async function() {
    console.log('بدء تهيئة التطبيق...');
    await ensureAdminExists();
    
    if (!isLoggedIn()) {
        console.log('المستخدم غير مسجل الدخول، عرض نموذج تسجيل الدخول');
        showLoginForm();
    } else {
        console.log('المستخدم مسجل الدخول، تهيئة لوحة التحكم');
        initializeAdminPanel();
    }
});

// التحقق من حالة تسجيل الدخول
function isLoggedIn() {
    return sessionStorage.getItem('adminLoggedIn') === 'true';
}

// عرض نموذج تسجيل الدخول
function showLoginForm() {
    const loginHtml = `
        <div class="login-container">
            <div class="card">
                <div class="card-body">
                    <h3 class="text-center mb-4">تسجيل الدخول للوحة التحكم</h3>
                    <form id="loginForm" onsubmit="handleLogin(event)">
                        <div class="mb-3">
                            <label class="form-label">البريد الإلكتروني</label>
                            <input type="email" class="form-control" id="adminEmail" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">كلمة المرور</label>
                            <input type="password" class="form-control" id="adminPassword" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 mb-3">دخول</button>
                        <button type="button" class="btn btn-link w-100" onclick="showResetPasswordForm()">
                            نسيت كلمة المرور؟
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.querySelector('.dashboard-container').innerHTML = loginHtml;
}

// تسجيل الخروج
async function logout() {
    try {
        await firebase.auth().signOut();
        sessionStorage.removeItem('adminLoggedIn');
        location.reload();
    } catch (error) {
        console.error('Error signing out:', error);
        showError('حدث خطأ أثناء تسجيل الخروج');
    }
}

// تهيئة لوحة التحكم
async function initializeAdminPanel() {
    try {
        // التحقق من اتصال Firebase
        await db.enableNetwork();
        console.log('تم الاتصال بـ Firebase بنجاح');
        
        // إنشاء هيكل واجهة المستخدم
        createAdminInterface();
        
        // تهيئة المكونات
        initializeEventListeners();
        setupAdvancedFeatures();
        
        // تحميل البيانات
        await loadData();
    } catch (error) {
        console.error('خطأ في تهيئة التطبيق:', error);
        showError('حدث خطأ في تهيئة التطبيق');
    }
}

// إنشاء واجهة المستخدم
function createAdminInterface() {
    const container = document.querySelector('.dashboard-container');
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3">لوحة التحكم - إدارة البيانات</h1>
            <div class="btn-group">
                <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#exportModal">
                    <i class="bi bi-download"></i> تصدير
                </button>
                <button class="btn btn-danger" onclick="deleteSelected()">
                    <i class="bi bi-trash"></i> حذف المحدد
                </button>
                <button class="btn btn-secondary" onclick="logout()">
                    <i class="bi bi-box-arrow-right"></i> تسجيل الخروج
                </button>
            </div>
        </div>

        <!-- Stats Cards -->
        <div class="stats-cards">
            <div class="stat-card">
                <h5>إجمالي السجلات</h5>
                <h2 id="totalRecords">0</h2>
            </div>
            <div class="stat-card">
                <h5>السجلات النشطة</h5>
                <h2 id="activeRecords">0</h2>
            </div>
            <div class="stat-card">
                <h5>آخر تحديث</h5>
                <h2 id="lastUpdate">-</h2>
            </div>
        </div>

        <!-- Search and Filters -->
        <div class="search-filters">
            <div class="row g-3">
                <div class="col-md-4">
                    <input type="text" class="form-control" id="searchBox" placeholder="بحث...">
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="statusFilter">
                        <option value="">الحالة - الكل</option>
                        <option value="pending">في انتظار التأكيد</option>
                        <option value="confirmed">مؤكد</option>
                        <option value="rejected">مرفوض</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="sortBy">
                        <option value="date_desc">الأحدث أولاً</option>
                        <option value="date_asc">الأقدم أولاً</option>
                        <option value="name_asc">الاسم (أ-ي)</option>
                        <option value="name_desc">الاسم (ي-أ)</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button class="btn btn-secondary w-100" onclick="resetFilters()">
                        <i class="bi bi-arrow-counterclockwise"></i> إعادة تعيين
                    </button>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <div class="data-table">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>
                            <input type="checkbox" class="form-check-input" id="selectAll">
                        </th>
                        <th>الرقم التعريفي</th>
                        <th>الاسم</th>
                        <th>رقم الهاتف</th>
                        <th>حالة التسجيل</th>
                        <th>تاريخ التسجيل</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody id="dataTableBody"></tbody>
            </table>
            <div class="pagination-container d-flex justify-content-between align-items-center">
                <div class="pages-info">
                    عرض <span id="currentRange">0-0</span> من <span id="totalItems">0</span>
                </div>
                <nav aria-label="Page navigation">
                    <ul class="pagination mb-0" id="pagination"></ul>
                </nav>
            </div>
        </div>
    `;
}

// إعداد الميزات المتقدمة
function setupAdvancedFeatures() {
    // إضافة أزرار التصفية السريعة
    const quickFilters = document.createElement('div');
    quickFilters.className = 'quick-filters mb-3';
    quickFilters.innerHTML = `
        <div class="btn-group">
            <button class="btn btn-outline-primary" onclick="filterByDate('today')">اليوم</button>
            <button class="btn btn-outline-primary" onclick="filterByDate('week')">هذا الأسبوع</button>
            <button class="btn btn-outline-primary" onclick="filterByDate('month')">هذا الشهر</button>
        </div>
    `;
    document.querySelector('.search-filters').prepend(quickFilters);

    // إضافة خيارات العرض
    const viewOptions = document.createElement('div');
    viewOptions.className = 'view-options mb-3';
    viewOptions.innerHTML = `
        <div class="btn-group">
            <button class="btn btn-outline-secondary" onclick="toggleView('table')">
                <i class="bi bi-table"></i> جدول
            </button>
            <button class="btn btn-outline-secondary" onclick="toggleView('cards')">
                <i class="bi bi-grid"></i> بطاقات
            </button>
        </div>
    `;
    document.querySelector('.search-filters').prepend(viewOptions);
}

// تصفية حسب التاريخ
function filterByDate(period) {
    const today = new Date();
    const startDate = new Date();
    
    switch(period) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(today.getMonth() - 1);
            break;
    }

    filteredData = currentData.filter(item => {
        const itemDate = new Date(item[FIELD_KEYS.TIMESTAMP]);
        return itemDate >= startDate && itemDate <= today;
    });
    
    currentPage = 1;
    displayData();
}

// تبديل طريقة العرض
function toggleView(viewType) {
    const container = document.querySelector('.data-table');
    if (viewType === 'cards') {
        displayDataAsCards();
    } else {
        displayData();
    }
}

// عرض البيانات كبطاقات
function displayDataAsCards() {
    const container = document.querySelector('.data-table');
    container.innerHTML = '<div class="row g-3" id="cardsContainer"></div>';
    const cardsContainer = document.getElementById('cardsContainer');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    pageData.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'col-md-4';
        card.innerHTML = `
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${entry[FIELD_KEYS.NIN]}</h6>
                    <span class="status-badge ${entry.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${entry.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </div>
                <div class="card-body">
                    <h5 class="card-title">${entry[FIELD_KEYS.NAME_AR]}</h5>
                    <p class="card-text">${entry[FIELD_KEYS.PHONE]}</p>
                    <p class="card-text"><small class="text-muted">
                        ${new Date(entry[FIELD_KEYS.TIMESTAMP]).toLocaleString('ar-SA')}
                    </small></p>
                </div>
                <div class="card-footer">
                    <div class="btn-group w-100">
                        <button class="btn btn-primary" onclick='showDetails(${JSON.stringify(entry)})'>
                            <i class="bi bi-eye"></i> عرض التفاصيل
                        </button>
                        <button class="btn btn-danger" onclick='deleteRecord("${entry.id}")'>
                            <i class="bi bi-trash"></i> حذف
                        </button>
                    </div>
                </div>
            </div>
        `;
        cardsContainer.appendChild(card);
    });

    // إضافة التصفح
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    paginationContainer.innerHTML = `
        <nav aria-label="Page navigation">
            <ul class="pagination justify-content-center" id="pagination"></ul>
        </nav>
    `;
    container.appendChild(paginationContainer);
    updatePagination();
}

// تصدير البيانات
async function exportData() {
    const format = document.getElementById('exportFormat').value;
    const range = document.getElementById('exportRange').value;

    let dataToExport = [];
    switch (range) {
        case 'selected':
            const selectedIds = Array.from(document.querySelectorAll('tbody input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.dataset.id);
            dataToExport = filteredData.filter(item => selectedIds.includes(item.id));
            break;
        case 'filtered':
            dataToExport = filteredData;
            break;
        case 'all':
            dataToExport = currentData;
            break;
    }

    if (dataToExport.length === 0) {
        showError('لا توجد بيانات للتصدير');
        return;
    }

    switch (format) {
        case 'excel':
            exportToExcel(dataToExport);
            break;
        case 'pdf':
            exportToPDF(dataToExport);
            break;
        case 'txt':
            exportToTXT(dataToExport);
            break;
        case 'html':
            exportToHTML(dataToExport);
            break;
        case 'word':
            exportToWord(dataToExport);
            break;
        case 'print':
            printData(dataToExport);
            break;
    }

    const exportModal = bootstrap.Modal.getInstance(document.getElementById('exportModal'));
    exportModal.hide();
}

// تصدير إلى Excel
function exportToExcel(data) {
    // تحويل البيانات إلى تنسيق مناسب للإكسل
    const excelData = data.map(item => ({
        'الرقم التعريفي الوطني': item[FIELD_KEYS.NIN] || '',
        'رقم الضمان الإجتماعي': item['رقم الضمان الإجتماعي (NSS)'] || '',
        'تاريخ الميلاد': item['تاريخ الميلاد'] || '',
        'رقم الهاتف': item[FIELD_KEYS.PHONE] || '',
        'رقم التسجيل': item['رقم التسجيل التسلسلي'] || '',
        'إسم الأب بالعربية': item[FIELD_KEYS.NAME_AR] || '',
        'إسم الأب بالفرنسية': item[FIELD_KEYS.NAME_FR] || '',
        'لقب الأم بالعربية': item['لقب الأم بالعربية'] || '',
        'لقب الأم بالفرنسية': item['لقب الأم بالفرنسية'] || '',
        'إسم الأم بالعربية': item['إسم الأم بالعربية'] || '',
        'إسم الأم بالفرنسية': item['إسم الأم بالفرنسية'] || '',
        'تاريخ ميلاد الأب': item['تاريخ ميلاد الأب'] || '',
        'تاريخ ميلاد الأم': item['تاريخ ميلاد الأم'] || '',
        'مكان ميلاد الأب': item['مكان ميلاد الأب'] || '',
        'مكان ميلاد الأم': item['مكان ميلاد الأم'] || '',
        'المهنة': item['المهنة'] || '',
        'الراتب': item['الراتب'] || '',
        'مكان العمل': item['مكان العمل'] || '',
        'الحالة': item.status === 'active' ? 'نشط' : 'غير نشط',
        'تاريخ التسجيل': new Date(item[FIELD_KEYS.TIMESTAMP]).toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }));

    // إنشاء مصفوفة تتضمن رؤوس الأعمدة والبيانات
    const ws_data = [
        Object.keys(excelData[0]), // رؤوس الأعمدة
        ...excelData.map(obj => Object.values(obj)) // البيانات
    ];

    // إنشاء ورقة عمل جديدة
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // تعيين عرض الأعمدة
    const columnWidths = Object.keys(excelData[0]).map(() => ({ wch: 20 }));
    ws['!cols'] = columnWidths;

    // إنشاء مصنف عمل جديد وإضافة ورقة العمل إليه
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "البيانات");

    // تصدير الملف
    XLSX.writeFile(wb, `تقرير_البيانات_${new Date().toISOString()}.xlsx`);
}

// تصدير إلى Word
function exportToWord(data) {
    let content = `
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f4f4f4; }
            </style>
        </head>
        <body>
            <h1>تقرير البيانات</h1>
            <table>
                <thead>
                    <tr>
                        <th>الرقم التعريفي</th>
                        <th>الاسم</th>
                        <th>رقم الهاتف</th>
                        <th>التاريخ</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(item => {
        content += `
            <tr>
                <td>${item[FIELD_KEYS.NIN] || '-'}</td>
                <td>${item[FIELD_KEYS.NAME_AR] || '-'}</td>
                <td>${item[FIELD_KEYS.PHONE] || '-'}</td>
                <td>${new Date(item[FIELD_KEYS.TIMESTAMP]).toLocaleString('fr-FR')}</td>
            </tr>
        `;
    });

    content += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([content], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_البيانات_${new Date().toISOString()}.doc`;
    link.click();
}

// طباعة البيانات
function printData(data) {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة البيانات</title>
            <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f4f4f4; }
                @media print {
                    th { background-color: #f4f4f4 !important; -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <h1>تقرير البيانات</h1>
            <table>
                <thead>
                    <tr>
                        <th>الرقم التعريفي</th>
                        <th>الاسم</th>
                        <th>رقم الهاتف</th>
                        <th>التاريخ</th>
                    </tr>
                </thead>
                <tbody>
    `);

    data.forEach(item => {
        printWindow.document.write(`
            <tr>
                <td>${item[FIELD_KEYS.NIN] || '-'}</td>
                <td>${item[FIELD_KEYS.NAME_AR] || '-'}</td>
                <td>${item[FIELD_KEYS.PHONE] || '-'}</td>
                <td>${new Date(item[FIELD_KEYS.TIMESTAMP]).toLocaleString('fr-FR')}</td>
            </tr>
        `);
    });

    printWindow.document.write(`
                </tbody>
            </table>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

// تصدير إلى PDF
function exportToPDF(data) {
    const content = generateHTMLContent(data);
    const style = `
        <style>
            body { font-family: Arial, sans-serif; direction: rtl; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f4f4f4; }
            h1 { text-align: center; color: #2c3e50; }
            .section { margin: 20px 0; }
            .section-title { color: #34495e; border-bottom: 2px solid #eee; padding-bottom: 5px; }
        </style>
    `;

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            ${style}
        </head>
        <body>
            ${content}
        </body>
    </html>`;

    // استخدام html2pdf
    const opt = {
        margin: 1,
        filename: `تقرير_البيانات_${new Date().toISOString()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(html).save();
}

// تصدير إلى TXT
function exportToTXT(data) {
    let content = '';

    data.forEach((item, index) => {
        if (index > 0) {
            content += '\n\n----------------------------------------\n\n';
        }

        // المعلومات الشخصية
        content += `الرقم التعريفي الوطني الوحيد ( NIN ) : ${item.nin || ''}\n`;
        content += `رقم الضمان الإجتماعي ( NSS ) : ${item.nss || ''}\n`;
        content += `تاريخ الميلاد (Date de Naissance) : ${formatDate(item.birthDate)}\n`;
        content += `رقم الهاتف ( Numéro de téléphone ) : ${item.phone || ''}\n`;
        content += `رقم التسجيل التسلسلي ( Code ): ${item.registrationCode || ''}\n`;
        content += `كلمة المرور ( mot de passe ) : a0000@AA\n`;
        content += `تأكيد كلمة المرور ( Confirmation de mot de passe ) : a0000@AA\n`;

        // معلومات الأب
        content += `إسم الأب : ${item.fatherNameAr || ''}\n`;
        content += `Prénom du père : ${item.fatherNameFr || ''}\n`;

        // معلومات الأم
        content += `لقب الأم : ${item.motherLastNameAr || ''}\n`;
        content += `Nom de la mère : ${item.motherLastNameFr || ''}\n`;
        content += `إسم الأم : ${item.motherNameAr || ''}\n`;
        content += `Prénom de la mère : ${item.motherNameFr || ''}\n`;

        // تواريخ ميلاد الوالدين
        content += `تاريخ ميلاد الأب ( Date de naissance du père ) : ${formatDate(item.fatherBirthDate)}\n`;
        content += `تاريخ ميلاد الأم ( Date de naissance de la mère ) : ${formatDate(item.motherBirthDate)}\n`;

        // أماكن ميلاد الوالدين
        content += `مكان ميلاد الأب ( Lieux de naissance du père ) : ${item.fatherBirthPlace || ''}\n`;
        content += `مكان ميلاد الأم ( Lieux de naissance de la mère ) : ${item.motherBirthPlace || ''}\n`;

        // معلومات مهنية
        content += `المهنة ( Profession ) : ${item.profession || ''}\n`;
        content += `الراتب ( لشهر جوان 2024) - Salaire ( du mois de Juin 2024) : ${item.salary || '0'}\n`;
        content += `مكان العمل ( Employeur ) : ${item.employer || ''}\n`;

        // معلومات الزوج/ة إذا كانت موجودة
        if (item.maritalStatus === 'married' || item.maritalStatus === 'widowed') {
            content += `إسم أب الزوج/ة : ${item.spouseFatherNameAr || ''}\n`;
            content += `Prénom du père du conjoint : ${item.spouseFatherNameFr || ''}\n`;
            content += `لقب أم الزوج/ة : ${item.spouseMotherLastNameAr || ''}\n`;
            content += `Nom de la mère du conjoint : ${item.spouseMotherLastNameFr || ''}\n`;
            content += `إسم أم الزوج/ة : ${item.spouseMotherNameAr || ''}\n`;
            content += `Prénom de la mère du conjoint : ${item.spouseMotherNameFr || ''}\n`;
            content += `تاريخ ميلاد أب الزوج/ة( Date de naissance du père du conjoint) : ${formatDate(item.spouseFatherBirthDate)}\n`;
            content += `تاريخ ميلاد أم الزوج/ة( Date de naissance de la mère du conjoint ) : ${formatDate(item.spouseMotherBirthDate)}\n`;
            content += `مكان ميلاد أب الزوج/ة ( Lieux de naissance du père du conjoint ) : ${item.spouseFatherBirthPlace || ''}\n`;
            content += `مكان ميلاد أم الزوج/ة( Lieux de naissance de la mère du conjoint ) : ${item.spouseMotherBirthPlace || ''}\n`;
            content += `مهنة الزوج/ة ( Profession du Conjoint ) : ${item.spouseProfession || 'لا توجد'}\n`;
            content += `الراتب للزوج(ة) ( لشهر جوان 2024 ) - Salaire Conjoint ( du mois de Juin 2024 ) : ${item.spouseSalary || '0'}\n`;
            content += `مكان العمل للزوج(ة) - Employeur Conjoint : ${item.spouseEmployer || 'لايوجد'}`;
        }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `بيانات_المستخدم_${new Date().toISOString()}.txt`;
    link.click();
}

// دالة تنسيق التاريخ
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // إذا كان التاريخ غير صالح، إرجاع النص كما هو
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
}

// إضافة دالة تصدير HTML
function exportToHTML(data) {
    const style = `
        <style>
            body {
                font-family: Arial, sans-serif;
                direction: rtl;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
                text-align: center;
                color: #2c3e50;
                margin-bottom: 30px;
            }
            .section {
                margin-bottom: 30px;
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
            }
            .section-title {
                color: #34495e;
                border-bottom: 2px solid #eee;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: right;
            }
            th {
                background-color: #f4f4f4;
                font-weight: bold;
            }
            tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .timestamp {
                text-align: left;
                color: #666;
                font-size: 0.9em;
            }
        </style>
    `;

    const html = `<!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>تقرير البيانات</title>
        ${style}
    </head>
    <body>
        <div class="container">
            <h1>تقرير البيانات</h1>
            ${data.map((item, index) => `
                <div class="section">
                    <h2 class="section-title">سجل رقم ${index + 1}</h2>
                    <table>
                        <tbody>
                            ${Object.entries(item)
                                .filter(([key, value]) => value && typeof value === 'string')
                                .map(([key, value]) => `
                                    <tr>
                                        <th>${key}</th>
                                        <td>${value}</td>
                                    </tr>
                                `).join('')}
                        </tbody>
                    </table>
                    <div class="timestamp">
                        تاريخ التسجيل: ${new Date(item[FIELD_KEYS.TIMESTAMP]).toLocaleString('fr-FR')}
                    </div>
                </div>
            `).join('')}
        </div>
    </body>
    </html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_البيانات_${new Date().toISOString()}.html`;
    link.click();
}

// تصدير إلى HTML
function generateHTMLContent(data) {
    let content = '';
    data.forEach(item => {
        content += `
            <div class="section">
                <h2 class="section-title">سجل رقم ${item.id}</h2>
                <table>
                    <tbody>
                        ${Object.entries(item)
                            .filter(([key, value]) => value && typeof value === 'string')
                            .map(([key, value]) => `
                                <tr>
                                    <th>${key}</th>
                                    <td>${value}</td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>
                <div class="timestamp">
                    تاريخ التسجيل: ${new Date(item[FIELD_KEYS.TIMESTAMP]).toLocaleString('fr-FR')}
                </div>
            </div>
        `;
    });
    return content;
}

// تطبيق التصفية والترتيب
function applyFiltersAndSort() {
    const searchText = document.getElementById('searchBox').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    // تطبيق التصفية
    filteredData = currentData.filter(item => {
        const matchesSearch = Object.values(item).some(value => 
            value && value.toString().toLowerCase().includes(searchText)
        );
        const matchesStatus = !statusFilter || item.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // تطبيق الترتيب
    switch (sortBy) {
        case 'date_desc':
            filteredData.sort((a, b) => b.timestamp - a.timestamp);
            break;
        case 'date_asc':
            filteredData.sort((a, b) => a.timestamp - b.timestamp);
            break;
        case 'name_asc':
            filteredData.sort((a, b) => (a[FIELD_KEYS.NAME_AR] || '').localeCompare(b[FIELD_KEYS.NAME_AR] || ''));
            break;
        case 'name_desc':
            filteredData.sort((a, b) => (b[FIELD_KEYS.NAME_AR] || '').localeCompare(a[FIELD_KEYS.NAME_AR] || ''));
            break;
    }

    currentPage = 1;
    displayData();
}

// عرض البيانات في الجدول
function displayData() {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) {
        console.error('لم يتم العثور على عنصر الجدول');
        return;
    }

    tbody.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">لا توجد بيانات للعرض</td>
            </tr>
        `;
        return;
    }

    pageData.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input" data-id="${entry.id || ''}">
            </td>
            <td>${entry.nin || '-'}</td>
            <td>
                <div>${entry.fatherNameAr || '-'}</div>
                <small class="text-muted">${entry.fatherNameFr || '-'}</small>
            </td>
            <td>${entry.phone || '-'}</td>
            <td>
                <span class="status-badge ${getStatusClass(entry.status)}">
                    ${getStatusText(entry.status)}
                </span>
            </td>
            <td>${formatTimestamp(entry.timestamp)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-primary" onclick='showDetails(${JSON.stringify(entry)})' title="عرض التفاصيل">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-warning" onclick='showEditForm(${JSON.stringify(entry)})' title="تعديل">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-danger" onclick='deleteRecord("${entry.id}")' title="حذف">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    updatePagination();
    updateSelectedCount();
    updateStats();
}

// دالة تنسيق حالة السجل
function getStatusClass(status) {
    switch (status) {
        case 'active':
            return 'status-active';
        case 'pending':
            return 'status-pending';
        case 'confirmed':
            return 'status-confirmed';
        case 'rejected':
            return 'status-rejected';
        default:
            return 'status-inactive';
    }
}

// دالة تحويل حالة السجل إلى نص
function getStatusText(status) {
    switch (status) {
        case 'active':
            return 'نشط';
        case 'pending':
            return 'قيد الانتظار';
        case 'confirmed':
            return 'مؤكد';
        case 'rejected':
            return 'مرفوض';
        default:
            return 'غير نشط';
    }
}

// دالة تنسيق التاريخ والوقت
function formatTimestamp(timestamp) {
    if (!timestamp) return 'غير محدد';
    
    try {
        // Handle Firestore Timestamp objects
        if (timestamp.toDate) {
            timestamp = timestamp.toDate();
        }
        
        // Handle string timestamps
        if (typeof timestamp === 'string') {
            timestamp = new Date(timestamp);
        }

        // Check if timestamp is valid
        if (isNaN(timestamp.getTime())) {
            return 'تاريخ غير صالح';
        }

        // Format the date in Arabic
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };

        return new Intl.DateTimeFormat('ar-SA', options).format(timestamp);
    } catch (error) {
        console.error('خطأ في تنسيق التاريخ:', error);
        return 'خطأ في التاريخ';
    }
}

// تحديث التصفح
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    let html = '';
    
    // زر السابق
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">&raquo;</a>
        </li>
    `;

    // أرقام الصفحات
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                </li>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<li class="page-item disabled"><a class="page-link">...</a></li>';
        }
    }

    // زر التالي
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">&laquo;</a>
        </li>
    `;

    pagination.innerHTML = html;

    // تحديث معلومات النطاق
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);
    
    if (document.getElementById('currentRange')) {
        document.getElementById('currentRange').textContent = `${startItem}-${endItem}`;
    }
    if (document.getElementById('totalItems')) {
        document.getElementById('totalItems').textContent = filteredData.length;
    }
}

// تغيير الصفحة
function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayData();
}

// تهيئة أحداث المستمعين
function initializeEventListeners() {
    const searchBox = document.getElementById('searchBox');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');
    const selectAll = document.getElementById('selectAll');

    if (searchBox) searchBox.addEventListener('input', handleSearch);
    if (statusFilter) statusFilter.addEventListener('change', handleFilters);
    if (sortBy) sortBy.addEventListener('change', handleSort);
    if (selectAll) selectAll.addEventListener('change', handleSelectAll);
}

// معالجة البحث
function handleSearch(e) {
    applyFiltersAndSort();
}

// معالجة التصفية
function handleFilters() {
    applyFiltersAndSort();
}

// معالجة الترتيب
function handleSort() {
    applyFiltersAndSort();
}

// معالجة تحديد الكل
function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
    updateSelectedCount();
}

// تحديث عدد العناصر المحددة
function updateSelectedCount() {
    const selectedCount = document.querySelectorAll('tbody input[type="checkbox"]:checked').length;
    const totalCount = document.querySelectorAll('tbody input[type="checkbox"]').length;
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.checked = selectedCount === totalCount && totalCount > 0;
    }
}

// إظهار رسالة نجاح
function showSuccess(message) {
    showAlert(message, 'success');
}

// إظهار رسالة خطأ
function showError(message) {
    showAlert(message, 'danger');
}

// إظهار تنبيه
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

// إظهار مؤشر التحميل
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

// إخفاء مؤشر التحميل
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// عرض التفاصيل في النموذج
function showDetails(data) {
    const detailsContent = document.getElementById('detailsContent');
    if (!detailsContent) return;

    let content = `
        <div class="details-container">
            <div class="detail-section">
                <h4 class="section-title mb-3">المعلومات الشخصية</h4>
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <strong>الرقم التعريفي الوطني:</strong>
                        <div>${data.nin || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>رقم الضمان الإجتماعي:</strong>
                        <div>${data.nss || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>رقم الهاتف:</strong>
                        <div>${data.phone || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>تاريخ الميلاد:</strong>
                        <div>${formatDate(data.birthDate) || '-'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section mt-4">
                <h4 class="section-title mb-3">معلومات الأب</h4>
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <strong>إسم الأب بالعربية:</strong>
                        <div>${data.fatherNameAr || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>إسم الأب بالفرنسية:</strong>
                        <div>${data.fatherNameFr || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>تاريخ ميلاد الأب:</strong>
                        <div>${formatDate(data.fatherBirthDate) || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>مكان ميلاد الأب:</strong>
                        <div>${data.fatherBirthPlace || '-'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section mt-4">
                <h4 class="section-title mb-3">معلومات الأم</h4>
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <strong>إسم الأم بالعربية:</strong>
                        <div>${data.motherNameAr || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>إسم الأم بالفرنسية:</strong>
                        <div>${data.motherNameFr || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>لقب الأم بالعربية:</strong>
                        <div>${data.motherLastNameAr || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>لقب الأم بالفرنسية:</strong>
                        <div>${data.motherLastNameFr || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>تاريخ ميلاد الأم:</strong>
                        <div>${formatDate(data.motherBirthDate) || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>مكان ميلاد الأم:</strong>
                        <div>${data.motherBirthPlace || '-'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section mt-4">
                <h4 class="section-title mb-3">المعلومات المهنية</h4>
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <strong>المهنة:</strong>
                        <div>${data.profession || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>الراتب:</strong>
                        <div>${data.salary || '0'} دج</div>
                    </div>
                    <div class="col-md-12 mb-2">
                        <strong>مكان العمل:</strong>
                        <div>${data.employer || '-'}</div>
                    </div>
                </div>
            </div>

            ${data.maritalStatus === 'married' || data.maritalStatus === 'widowed' ? `
                <div class="detail-section mt-4">
                    <h4 class="section-title mb-3">معلومات الزوج/ة</h4>
                    <div class="row">
                        <div class="col-md-6 mb-2">
                            <strong>الرقم التعريفي للزوج/ة:</strong>
                            <div>${data.nin_conjoint || '-'}</div>
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>رقم الضمان الإجتماعي للزوج/ة:</strong>
                            <div>${data.nss_conjoint || '-'}</div>
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>مهنة الزوج/ة:</strong>
                            <div>${data.spouseProfession || '-'}</div>
                        </div>
                        <div class="col-md-6 mb-2">
                            <strong>راتب الزوج/ة:</strong>
                            <div>${data.spouseSalary || '0'} دج</div>
                        </div>
                        <div class="col-md-12 mb-2">
                            <strong>مكان عمل الزوج/ة:</strong>
                            <div>${data.spouseEmployer || '-'}</div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="detail-section mt-4">
                <h4 class="section-title mb-3">معلومات النظام</h4>
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <strong>حالة التسجيل:</strong>
                        <div>
                            <span class="status-badge ${getStatusClass(data.status)}">
                                ${getStatusText(data.status)}
                            </span>
                        </div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <strong>تاريخ التسجيل:</strong>
                        <div>${formatTimestamp(data.timestamp)}</div>
                    </div>
                    <div class="col-md-12 mb-2">
                        <strong>ملاحظات:</strong>
                        <div>${data.notes || 'لا توجد ملاحظات'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    detailsContent.innerHTML = content;
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
}

// عرض نموذج التعديل
function showEditForm(data) {
    const editModal = document.createElement('div');
    editModal.className = 'modal fade';
    editModal.id = 'editModal';
    editModal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">تعديل البيانات</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="editForm">
                        <input type="hidden" id="editId" value="${data.id}">
                        <div class="mb-3">
                            <label class="form-label">الرقم التعريفي الوطني (NIN)</label>
                            <input type="text" class="form-control" id="editNin" value="${data.nin}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">رقم الضمان الإجتماعي (NSS)</label>
                            <input type="text" class="form-control" id="editNss" value="${data.nss}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">رقم الهاتف</label>
                            <input type="tel" class="form-control" id="editPhone" value="${data.phone}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">الحالة</label>
                            <select class="form-select" id="editStatus">
                                <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                                <option value="confirmed" ${data.status === 'confirmed' ? 'selected' : ''}>مؤكد</option>
                                <option value="rejected" ${data.status === 'rejected' ? 'selected' : ''}>مرفوض</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">ملاحظات</label>
                            <textarea class="form-control" id="editNotes" rows="3">${data.notes || ''}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                    <button type="button" class="btn btn-primary" onclick="saveEdit()">حفظ التغييرات</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(editModal);
    new bootstrap.Modal(editModal).show();
}

// حفظ التعديلات
async function saveEdit() {
    try {
        showLoading();
        const id = document.getElementById('editId').value;
        const updatedData = {
            nin: document.getElementById('editNin').value,
            nss: document.getElementById('editNss').value,
            phone: document.getElementById('editPhone').value,
            status: document.getElementById('editStatus').value,
            notes: document.getElementById('editNotes').value,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        // التحقق من صحة البيانات
        if (!updatedData.nin || !updatedData.nss || !updatedData.phone) {
            throw new Error('جميع الحقول الإلزامية مطلوبة');
        }

        // تحديث البيانات في Firebase
        await db.collection('users').doc(id).update(updatedData);

        // إغلاق النموذج وتحديث العرض
        const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        modal.hide();
        document.getElementById('editModal').remove();

        // تحديث البيانات في الواجهة
        await loadData();
        showSuccess('تم تحديث البيانات بنجاح');
    } catch (error) {
        console.error('Error updating document:', error);
        showError(error.message || 'حدث خطأ أثناء تحديث البيانات');
    } finally {
        hideLoading();
    }
}

// حذف السجل
async function deleteRecord(id) {
    if (await showConfirm('هل أنت متأكد من حذف هذا السجل؟')) {
        try {
            showLoading();
            await db.collection('users').doc(id).delete();
            await loadData();
            showSuccess('تم حذف السجل بنجاح');
        } catch (error) {
            console.error('Error deleting document:', error);
            showError('حدث خطأ أثناء حذف السجل');
        } finally {
            hideLoading();
        }
    }
}

// إظهار تنبيه التأكيد
function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">تأكيد</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="button" class="btn btn-primary" id="confirmBtn">تأكيد</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        modal.querySelector('#confirmBtn').onclick = () => {
            modalInstance.hide();
            resolve(true);
        };
        
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
            resolve(false);
        });
    });
}

// تحميل البيانات من Firebase
async function loadData() {
    showLoading();
    try {
        // تحميل البيانات من مجموعة المستخدمين فقط
        const snapshot = await db.collection('users')
            .where('role', '!=', 'admin') // استثناء حسابات المسؤولين
            .get();
        
        currentData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).filter(user => 
            // استثناء السجلات الافتراضية والاختبارية
            user.nin && 
            user.nin !== 'test' && 
            user.email !== 'admin@aadl.dz'
        );
        
        // تحديث الإحصائيات
        updateStats();
        
        // تطبيق التصفية والترتيب
        applyFiltersAndSort();
        
        hideLoading();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('حدث خطأ أثناء تحميل البيانات');
        hideLoading();
    }
}

// تحديث الإحصائيات
function updateStats() {
    const totalRecordsElement = document.getElementById('totalRecords');
    const activeRecordsElement = document.getElementById('activeRecords');
    const lastUpdateElement = document.getElementById('lastUpdate');

    if (totalRecordsElement) {
        totalRecordsElement.textContent = currentData.length;
    }

    if (activeRecordsElement) {
        const activeCount = currentData.filter(item => item.status === 'active').length;
        activeRecordsElement.textContent = activeCount;
    }

    if (lastUpdateElement) {
        const latestRecord = currentData.reduce((latest, current) => {
            return (!latest || current.timestamp > latest.timestamp) ? current : latest;
        }, null);
        
        lastUpdateElement.textContent = latestRecord 
            ? new Date(latestRecord.timestamp).toLocaleString('ar-SA')
            : '-';
    }
}

// إعادة تعيين التصفية
function resetFilters() {
    const searchBox = document.getElementById('searchBox');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');

    if (searchBox) searchBox.value = '';
    if (statusFilter) statusFilter.value = '';
    if (sortBy) sortBy.value = 'date_desc';

    applyFiltersAndSort();
}

// عرض نموذج تحديث الحالة
function showStatusUpdateForm(id, currentStatus, currentNotes) {
    const modalHtml = `
        <div class="modal fade" id="statusUpdateModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">تحديث حالة التسجيل</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">الحالة</label>
                            <select class="form-select" id="statusSelect">
                                <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>في انتظار التأكيد</option>
                                <option value="confirmed" ${currentStatus === 'confirmed' ? 'selected' : ''}>مؤكد</option>
                                <option value="rejected" ${currentStatus === 'rejected' ? 'selected' : ''}>مرفوض</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">ملاحظات</label>
                            <textarea class="form-control" id="statusNotes" rows="3">${currentNotes || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="button" class="btn btn-primary" onclick="saveStatusUpdate('${id}')">حفظ التغييرات</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('statusUpdateModal'));
    modal.show();
    
    // إزالة النموذج بعد الإغلاق
    document.getElementById('statusUpdateModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// حفظ تحديث الحالة
function saveStatusUpdate(id) {
    const status = document.getElementById('statusSelect').value;
    const notes = document.getElementById('statusNotes').value;
    updateRegistrationStatus(id, status, notes);
    bootstrap.Modal.getInstance(document.getElementById('statusUpdateModal')).hide();
}

// تحديث حالة التسجيل
async function updateRegistrationStatus(id, status, notes) {
    try {
        await db.collection('users').doc(id).update({
            status: status,
            notes: notes || ''
        });
        showSuccess('تم تحديث حالة التسجيل بنجاح');
        loadData();
    } catch (error) {
        showError('حدث خطأ أثناء تحديث حالة التسجيل');
        console.error(error);
    }
}

// دالة إنشاء حساب مستخدم جديد
async function createUserAccount(email, password) {
    try {
        showLoading();
        // إنشاء حساب المستخدم
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // إضافة معلومات المستخدم إلى Firestore
        await db.collection('users').doc(user.uid).set({
            email: email,
            role: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showSuccess('تم إنشاء الحساب بنجاح');
        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
                break;
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'تسجيل المستخدمين غير مفعل';
                break;
            case 'auth/weak-password':
                errorMessage = 'كلمة المرور ضعيفة جداً';
                break;
        }
        
        showError(errorMessage);
        throw error;
    } finally {
        hideLoading();
    }
}

// دالة عرض نموذج إعادة تعيين كلمة المرور
function showResetPasswordForm() {
    const resetHtml = `
        <div class="login-container">
            <div class="card">
                <div class="card-body">
                    <h3 class="text-center mb-4">إعادة تعيين كلمة المرور</h3>
                    <form id="resetForm" onsubmit="handleResetPassword(event)">
                        <div class="mb-3">
                            <label class="form-label">البريد الإلكتروني</label>
                            <input type="email" class="form-control" id="resetEmail" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 mb-3">إرسال رابط إعادة التعيين</button>
                        <button type="button" class="btn btn-link w-100" onclick="showLoginForm()">
                            العودة لتسجيل الدخول
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.querySelector('.dashboard-container').innerHTML = resetHtml;
}

// دالة معالجة طلب إعادة تعيين كلمة المرور
function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    resetPassword(email);
}

// دالة إعادة تعيين كلمة المرور
async function resetPassword(email) {
    try {
        showLoading();
        await auth.sendPasswordResetEmail(email);
        showSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
    } catch (error) {
        console.error('Error resetting password:', error);
        let errorMessage = 'حدث خطأ أثناء إعادة تعيين كلمة المرور';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
            case 'auth/user-not-found':
                errorMessage = 'لم يتم العثور على المستخدم';
                break;
        }
        
        showError(errorMessage);
    } finally {
        hideLoading();
    }
} 
