const { expect } = require('chai');
const { ReasonCodes } = require('../../src/shared/reasonCodes');
const arLocale = require('../../renderer/i18n/locales/ar.json');
const enLocale = require('../../renderer/i18n/locales/en.json');

describe('Reason Codes and Locales Parity', () => {
  it('should have all reason codes defined in locale files', () => {
    const codes = Object.keys(ReasonCodes);
    expect(codes.length).to.be.greaterThan(0);

    for (const code of codes) {
      expect(arLocale.reasons).to.have.property(code);
      expect(enLocale.reasons).to.have.property(code);
      expect(arLocale.reasons[code]).to.be.a('string').and.not.empty;
      expect(enLocale.reasons[code]).to.be.a('string').and.not.empty;
    }
  });
});
