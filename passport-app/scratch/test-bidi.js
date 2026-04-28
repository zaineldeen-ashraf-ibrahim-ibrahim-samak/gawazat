const bidi = require('bidi-js')();
const ArabicReshaper = require('arabic-reshaper');

const text = "سفينة: Test Ship 123";
const reshaped = ArabicReshaper.convertArabic(text);

const embeddingLevels = bidi.getEmbeddingLevels(reshaped, 'rtl');
const bidiResult = bidi.getReorderedString(reshaped, embeddingLevels);

console.log('Original:', text);
console.log('Reshaped:', reshaped);
console.log('Bidi:', bidiResult);
