# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/capacity-1000.spec.js >> Capacity 1000 >> imports 1000 rows and lists them efficiently
- Location: tests/e2e/capacity-1000.spec.js:18:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('text="استيراد"')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e5]:
      - link "بوابة المسافرين" [ref=e6] [cursor=pointer]:
        - /url: "#/"
        - generic [ref=e7]: بوابة المسافرين
      - generic: 
      - generic [ref=e8]:
        - generic [ref=e9]:
          - link " لوحة التحكم" [ref=e10] [cursor=pointer]:
            - /url: "#/dashboard"
            - generic [ref=e11]: 
            - text: لوحة التحكم
          - link " استيراد بيانات" [ref=e12] [cursor=pointer]:
            - /url: "#/import"
            - generic [ref=e13]: 
            - text: استيراد بيانات
          - link " المسح الضوئي" [ref=e14] [cursor=pointer]:
            - /url: "#/scan"
            - generic [ref=e15]: 
            - text: المسح الضوئي
          - link " قائمة المسافرين" [ref=e16] [cursor=pointer]:
            - /url: "#/passengers"
            - generic [ref=e17]: 
            - text: قائمة المسافرين
          - link " سجل المسح" [ref=e18] [cursor=pointer]:
            - /url: "#/history"
            - generic [ref=e19]: 
            - text: سجل المسح
          - link " التقارير" [ref=e20] [cursor=pointer]:
            - /url: "#/reports"
            - generic [ref=e21]: 
            - text: التقارير
          - link " قيد المراجعه" [ref=e22] [cursor=pointer]:
            - /url: "#/pending"
            - generic [ref=e23]: 
            - text: قيد المراجعه
        - generic [ref=e24]:
          - button "" [ref=e25] [cursor=pointer]:
            - generic [ref=e26]: 
          - link " الإعدادات" [active] [ref=e27] [cursor=pointer]:
            - /url: "#/settings"
            - generic [ref=e28]: 
            - text: الإعدادات
          - combobox [ref=e29]:
            - option "العربية" [selected]
            - option "English"
  - main [ref=e30]:
    - generic [ref=e31]:
      - generic [ref=e32]:
        - heading "الإعدادات" [level=1] [ref=e33]
        - generic [ref=e35]:
          - generic [ref=e36]:
            - heading " الإعدادات" [level=5] [ref=e38]:
              - generic [ref=e39]: 
              - text: الإعدادات
            - generic [ref=e41]:
              - generic [ref=e42]:
                - generic [ref=e43]:
                  - generic [ref=e44]: اسم السفينة
                  - textbox [ref=e45]
                  - generic [ref=e46]: اسم السفينة أو القاطرة المستخدمة في هذه الرحلة، يظهر في التقارير المطبوعة.
                - generic [ref=e47]:
                  - generic [ref=e48]: إعادة تعيين تلقائية (ثواني)
                  - spinbutton [ref=e49]: "3"
                  - generic [ref=e50]: عدد الثواني قبل إعادة شاشة المسح تلقائياً بعد كل عملية قراءة. قلّل القيمة لعمليات أسرع.
              - generic [ref=e51]:
                - generic [ref=e52]:
                  - generic [ref=e53]:
                    - generic [ref=e54]: 
                    - text: وضع المسح
                  - combobox [ref=e55]:
                    - option "محاكاة لوحة المفاتيح" [selected]
                    - option "جهاز ريجولا"
                    - option "جهاز بينتا (DESKO)"
                  - generic [ref=e56]: "اختر طريقة توصيل قارئ جواز السفر: محاكاة لوحة المفاتيح للأجهزة البسيطة، أو اتصال مباشر بجهاز ريجولا أو بينتا."
                - generic [ref=e57]:
                  - generic [ref=e58]: فترة الاحتفاظ (أيام)
                  - spinbutton [ref=e59]: "30"
                  - generic [ref=e60]: عدد الأيام للاحتفاظ بسجلات المسح قبل حذفها تلقائياً. الحد الأدنى يوم واحد والأقصى 365 يوماً.
              - text:    
              - generic [ref=e62]:
                - generic [ref=e63]:
                  - checkbox "الأصوات" [checked] [ref=e64]
                  - generic [ref=e65]: الأصوات
                - generic [ref=e66]: تشغيل أصوات تنبيه عند نجاح المسح أو وجود تحذيرات أو أخطاء.
              - button " تأكيد" [ref=e68] [cursor=pointer]:
                - generic [ref=e69]: 
                - text: تأكيد
          - generic [ref=e70]:
            - generic [ref=e71]:
              - heading " مسار الملف والمراقبة التلقائية" [level=5] [ref=e72]:
                - generic [ref=e73]: 
                - text: مسار الملف والمراقبة التلقائية
              - generic [ref=e74]:
                - generic [ref=e75]: 
                - text: متوقفة
            - generic [ref=e76]:
              - paragraph [ref=e77]: المسار المُدخل يُستخدم لمراقبة الملف تلقائياً عند التحديث (File Watcher)، ويُستخدم أيضاً كمسار للـ API الداخلي. يُشغَّل تلقائياً عند بدء التطبيق بناءً على الإعداد المحفوظ.
              - generic [ref=e78]:
                - generic [ref=e80]:
                  - checkbox "تفعيل المراقبة" [ref=e81]
                  - generic [ref=e82]: تفعيل المراقبة
                - generic [ref=e83]:
                  - generic [ref=e84]: "المسار (مثال: C:\\MRZ.txt أو /import/mrz)"
                  - textbox [ref=e85]: /import/mrz
                - button " حفظ" [ref=e87] [cursor=pointer]:
                  - generic [ref=e88]: 
                  - text: حفظ
          - generic [ref=e89]:
            - generic [ref=e90]:
              - heading " إعدادات الحقول المطلوبة (Field Requirements)" [level=5] [ref=e91]:
                - generic [ref=e92]: 
                - text: إعدادات الحقول المطلوبة (Field Requirements)
              - button " حفظ الحقول" [ref=e93] [cursor=pointer]:
                - generic [ref=e94]: 
                - text: حفظ الحقول
            - generic [ref=e95]:
              - paragraph [ref=e96]: حدد الحقول الإلزامية عند المسح الضوئي أو الاستيراد. الحقول غير المحددة ستُعتبر اختيارية وستظهر بشارة "مفقود" إذا لم تتوفر.
              - table [ref=e98]:
                - rowgroup [ref=e99]:
                  - row "الحقل (Field Key) مطلوب (Required)" [ref=e100]:
                    - columnheader "الحقل (Field Key)" [ref=e101]
                    - columnheader "مطلوب (Required)" [ref=e102]
                - rowgroup [ref=e103]:
                  - row "رقم الجواز (Passport Number)" [ref=e104]:
                    - cell "رقم الجواز (Passport Number)" [ref=e105]
                    - cell [ref=e106]:
                      - checkbox [checked] [ref=e108]
                  - row "اسم العائلة / اللقب (Family Name)" [ref=e109]:
                    - cell "اسم العائلة / اللقب (Family Name)" [ref=e110]
                    - cell [ref=e111]:
                      - checkbox [checked] [ref=e113]
                  - row "الاسم الأول (Given Name)" [ref=e114]:
                    - cell "الاسم الأول (Given Name)" [ref=e115]
                    - cell [ref=e116]:
                      - checkbox [checked] [ref=e118]
                  - row "تاريخ الميلاد (Date of Birth)" [ref=e119]:
                    - cell "تاريخ الميلاد (Date of Birth)" [ref=e120]
                    - cell [ref=e121]:
                      - checkbox [checked] [ref=e123]
                  - row "الجنسية (Nationality)" [ref=e124]:
                    - cell "الجنسية (Nationality)" [ref=e125]
                    - cell [ref=e126]:
                      - checkbox [checked] [ref=e128]
                  - row "الجنس (Gender)" [ref=e129]:
                    - cell "الجنس (Gender)" [ref=e130]
                    - cell [ref=e131]:
                      - checkbox [ref=e133]
                  - row "نوع الوثيقة (Document Type)" [ref=e134]:
                    - cell "نوع الوثيقة (Document Type)" [ref=e135]
                    - cell [ref=e136]:
                      - checkbox [ref=e138]
          - generic [ref=e139]:
            - heading " مسح البيانات الحالية" [level=5] [ref=e141]:
              - generic [ref=e142]: 
              - text: مسح البيانات الحالية
            - generic [ref=e143]:
              - paragraph [ref=e144]: يحذف نهائياً بيانات الرحلة الحالية وجميع سجلات المسح والمسافرين. لا يمكن التراجع عن هذا الإجراء.
              - button " مسح البيانات الحالية" [ref=e145] [cursor=pointer]:
                - generic [ref=e146]: 
                - text: مسح البيانات الحالية
      - text:  
  - text: 
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const path = require('path');
  3  | const { _electron: electron } = require('playwright');
  4  | 
  5  | test.describe('Capacity 1000', () => {
  6  |   let electronApp;
  7  |   let window;
  8  | 
  9  |   test.beforeEach(async () => {
  10 |     electronApp = await electron.launch({ args: ['.'] });
  11 |     window = await electronApp.firstWindow();
  12 |   });
  13 | 
  14 |   test.afterEach(async () => {
  15 |     if (electronApp) await electronApp.close();
  16 |   });
  17 | 
  18 |   test('imports 1000 rows and lists them efficiently', async () => {
  19 |     // 1. Navigate to Settings and uncheck watch to avoid side-effects
  20 |     await window.click('text="الإعدادات"');
  21 |     
  22 |     // 2. Go to Import and drop the file
> 23 |     await window.click('text="استيراد"');
     |                  ^ Error: page.click: Target page, context or browser has been closed
  24 |     
  25 |     // Playwright doesn't easily drop files natively without file chooser, so we'll trigger the API directly for import
  26 |     await window.evaluate(async () => {
  27 |       const path = require('path');
  28 |       const fixture = path.join(__dirname, '..', 'fixtures', 'manifest-1000.xlsx');
  29 |       await window.api.manifest.import({ filePaths: [fixture] });
  30 |     });
  31 | 
  32 |     // 3. Go to Passenger List
  33 |     await window.click('text="الركاب"');
  34 | 
  35 |     // Wait for list to render
  36 |     await window.waitForSelector('table tbody tr');
  37 | 
  38 |     // 4. Assert performance budget and presence
  39 |     // Actually, checking row count in DOM might fail if windowed. We should check stats header.
  40 |     const stats = await window.locator('#list-stats').textContent();
  41 |     expect(stats).toContain('1000');
  42 | 
  43 |     // 5. Test search filter speed
  44 |     const startTime = Date.now();
  45 |     await window.fill('#search-input', 'EG0500');
  46 |     await window.waitForTimeout(100); // debounce wait
  47 |     const resultCount = await window.locator('table tbody tr').count();
  48 |     const endTime = Date.now();
  49 |     
  50 |     expect(resultCount).toBe(1);
  51 |     expect(endTime - startTime).toBeLessThan(2000);
  52 |   });
  53 | });
  54 | 
```