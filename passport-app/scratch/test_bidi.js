const bidiFactory = require('bidi-js');
const ArabicReshaper = require('arabic-reshaper');

const bidi = bidiFactory();

const text = 'قائمة المسافرين الجدد (أُضيفوا عند البوابة)';
console.log('Original:', text);

const reshaped = ArabicReshaper.convertArabic(text);
const visual = bidi.getReorderedString(reshaped);

console.log('Visual:', visual);
// If visual looks like ")ةباوبلا دنع اوفيقأ( ددجلا نيرفاسملا قائمة" then it's correct for LTR display.
