// Main app functionality
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('userDataForm');
    const maritalStatus = document.getElementById('maritalStatus');
    const spouseSection = document.getElementById('spouseSection');

    // Handle marital status changes
    maritalStatus.addEventListener('change', function() {
        handleMaritalStatusChange(this.value, spouseSection);
    });

    // Handle form submission
    form.addEventListener('submit', handleFormSubmit);

    // Setup input validation
    setupInputValidation();

    const familyStatusInputs = document.querySelectorAll('input[name="situation_familiale[]"], input[name="flag_celebataire"], input[name="flag_divorce"]');
    
    familyStatusInputs.forEach(input => {
        input.addEventListener('change', function() {
            // إلغاء تحديد الخيارات الأخرى
            familyStatusInputs.forEach(otherInput => {
                if (otherInput !== this) {
                    otherInput.checked = false;
                }
            });

            // إظهار/إخفاء قسم معلومات الزوج/ة
            const showSpouseSection = this.value === 'marie' || this.value === 'veuf';
            spouseSection.style.display = showSpouseSection ? 'block' : 'none';

            // تحديث حالة الحقول المطلوبة
            const spouseInputs = spouseSection.querySelectorAll('input');
            spouseInputs.forEach(input => {
                input.required = showSpouseSection;
            });
        });
    });
});

// Handle marital status changes
function handleMaritalStatusChange(status, spouseSection) {
    const showSpouseInfo = status === 'married' || status === 'widowed';
    spouseSection.style.display = showSpouseInfo ? 'block' : 'none';
    
    Array.from(spouseSection.getElementsByTagName('input')).forEach(input => {
        input.required = showSpouseInfo;
        if (!showSpouseInfo) input.value = '';
    });
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'جاري الإرسال...';
        
        const data = await collectFormData(e.target);
        await saveToFirebase(data);
        
        alert('تم إرسال البيانات بنجاح!');
        exportData(data);
        
        if (confirm('هل تريد إدخال بيانات جديدة؟')) {
            e.target.reset();
            document.getElementById('spouseSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'حدث خطأ أثناء إرسال البيانات. الرجاء المحاولة مرة أخرى.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Collect form data
function collectFormData(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (value.trim() !== '') {
            data[key] = value.trim();
        }
    }
    
    data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    data.status = 'active';
    
    if (!data.nin || !data.phone) {
        throw new Error('الرجاء ملء جميع الحقول المطلوبة');
    }
    
    return data;
}

// Save to Firebase
async function saveToFirebase(data) {
    try {
        await db.collection('users').doc(data.registrationCode).set(data);
    } catch (error) {
        throw new Error('فشل في حفظ البيانات في قاعدة البيانات');
    }
}

// Export data function
function exportData(data) {
    const cleanData = prepareDataForExport(data);
    const fullContent = generateContent(cleanData);
    
    // تصدير كملف TXT تلقائياً
    exportAsTxt(fullContent, cleanData.registrationCode);
}

// Prepare data for export
function prepareDataForExport(data) {
    const cleanData = { ...data };
    delete cleanData.timestamp;
    delete cleanData.status;
    return cleanData;
}

// Generate content for export
function generateContent(data) {
    const template = generateTemplate(data);
    const spouseInfo = data.spouseFatherNameAr ? generateSpouseInfo(data) : '';
    return template + spouseInfo;
}

// Export as TXT
function exportAsTxt(content, registrationCode) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    downloadFile(blob, `بيانات_المستخدم_${registrationCode}.txt`);
}

// Download file helper
function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Generate template helpers
function generateTemplate(data) {
    return `الرقم التعريفي الوطني الوحيد ( NIN ) : ${data.nin}
رقم الضمان الإجتماعي ( NSS ) : ${data.nss}
تاريخ الميلاد (Date de Naissance) : ${data.birthDate}
رقم الهاتف ( Numéro de téléphone ) : ${data.phone}
رقم التسجيل التسلسلي ( Code ): ${data.registrationCode}
إسم الأب : ${data.fatherNameAr}
Prénom du père : ${data.fatherNameFr}
لقب الأم : ${data.motherLastNameAr}
Nom de la mère : ${data.motherLastNameFr}
إسم الأم : ${data.motherNameAr}
Prénom de la mère : ${data.motherNameFr}
تاريخ ميلاد الأب ( Date de naissance du père ) : ${data.fatherBirthDate}
تاريخ ميلاد الأم ( Date de naissance de la mère ) : ${data.motherBirthDate}
مكان ميلاد الأب ( Lieux de naissance du père ) : ${data.fatherBirthPlace}
مكان ميلاد الأم ( Lieux de naissance de la mère ) : ${data.motherBirthPlace}
المهنة ( Profession ) : ${data.profession}
الراتب ( لشهر جوان 2024) - Salaire ( du mois de Juin 2024) : ${data.salary}
مكان العمل ( Employeur ) : ${data.employer}`;
}

function generateSpouseInfo(data) {
    return `
الرقم التعريفي الوطني الوحيد للزوج(ة) ( NIN Conjoint ) : ${data.nin_conjoint || ''}
رقم الضمان الإجتماعي للزوج(ة) ( NSS Conjoint ) : ${data.nss_conjoint || ''}
تاريخ ميلاد الزوج/ة ( Date de naissance Conjoint ) : ${data.date_nais_conjoint || ''}
لقب الزوج/ة ( Nom du conjoint ) : ${data.nom_conjoint || ''}
إسم الزوج/ة ( Prénom du conjoint ) : ${data.prenom_conjoint || ''}
إسم أب الزوج/ة : ${data.spouseFatherNameAr || ''}
Prénom du père du conjoint : ${data.spouseFatherNameFr || ''}
لقب أم الزوج/ة : ${data.spouseMotherLastNameAr || ''}
Nom de la mère du conjoint : ${data.spouseMotherLastNameFr || ''}
إسم أم الزوج/ة : ${data.spouseMotherNameAr || ''}
Prénom de la mère du conjoint : ${data.spouseMotherNameFr || ''}
تاريخ ميلاد أب الزوج/ة( Date de naissance du père du conjoint) : ${data.spouseFatherBirthDate || ''}
تاريخ ميلاد أم الزوج/ة( Date de naissance de la mère du conjoint ) : ${data.spouseMotherBirthDate || ''}
مكان ميلاد أب الزوج/ة ( Lieux de naissance du père du conjoint ) : ${data.spouseFatherBirthPlace || ''}
مكان ميلاد أم الزوج/ة( Lieux de naissance de la mère du conjoint ) : ${data.spouseMotherBirthPlace || ''}
مهنة الزوج/ة ( Profession du Conjoint ) : ${data.spouseProfession || ''}
الراتب للزوج(ة) ( لشهر جوان 2024 ) - Salaire Conjoint ( du mois de Juin 2024 ) : ${data.spouseSalary || '0'}
مكان العمل للزوج(ة) - Employeur Conjoint : ${data.spouseEmployer || ''}`;
}

// Setup input validation
function setupInputValidation() {
    // التحقق من NIN
    const ninInput = document.querySelector('input[name="nim"]');
    if (ninInput) {
        ninInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            validateNIN(this);
        });
    }

    // التحقق من NSS
    const nssInputs = document.querySelectorAll('input[name="nss"], input[name="nss_conjoint"]');
    nssInputs.forEach(input => {
        input.addEventListener('input', function() {
            validateNSS(this);
        });
    });

    // التحقق من رقم الهاتف
    const phoneInput = document.querySelector('input[name="numero_tlf"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            validatePhoneNumber(this);
        });
    }

    // التحقق من الرواتب
    const salaryInputs = document.querySelectorAll('input[name="salaire"], input[name="salaire_conjoint"]');
    salaryInputs.forEach(input => {
        input.addEventListener('input', function() {
            validateSalary(this);
        });
    });

    // التحقق من التواريخ
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.addEventListener('change', function() {
            validateDate(this);
        });
    });
}

// وظائف التحقق المحدثة
function validateNIN(input) {
    const value = input.value.trim();
    const isValid = /^[1-9][0-9]{17}$/.test(value);
    updateValidationUI(input, isValid, 'يجب أن يحتوي الرقم التعريفي على 18 رقماً بالضبط ولا يمكن أن يبدأ بـ 0');
}

function validateNSS(input) {
    const value = input.value.trim();
    const isValid = /^[a-zA-Z0-9]{4,13}$/.test(value);
    updateValidationUI(input, isValid, 'يجب أن يحتوي رقم الضمان الإجتماعي على 4 إلى 13 حرفاً أو رقماً فقط');
}

function validatePhoneNumber(input) {
    const value = input.value.trim();
    const isValid = /^\d{10}$/.test(value);
    updateValidationUI(input, isValid, 'يجب أن يتكون رقم الهاتف من 10 أرقام بالضبط');
}

function validateSalary(input) {
    const value = input.value.trim();
    const isValid = /^\d{1,6}([.]\d{1,2})?$/.test(value);
    updateValidationUI(input, isValid, 'يجب إدخال قيمة صحيحة للراتب');
}

function validateDate(input) {
    const value = input.value;
    const date = new Date(value);
    const minDate = new Date('1910-01-01');
    const maxDate = new Date('1988-12-31');
    
    const isValid = date >= minDate && date <= maxDate;
    updateValidationUI(input, isValid, 'يجب أن يكون التاريخ بين 1910 و 1988');
}

function updateValidationUI(input, isValid, errorMessage) {
    if (!isValid) {
        input.setCustomValidity(errorMessage);
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
    } else {
        input.setCustomValidity('');
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
    }
} 
