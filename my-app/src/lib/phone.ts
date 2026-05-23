import { parsePhoneNumberFromString } from 'libphonenumber-js';

const IN_REGION = 'IN' as const;

/** Strip all non-digits from raw user input. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** True when the 10-digit Indian mobile number is valid (mobile-only, not landline). */
export function isValidIndianMobile(localDigits: string): boolean {
  const cleaned = digitsOnly(localDigits);
  if (cleaned.length !== 10) return false;
  // Indian mobile numbers start with 6, 7, 8, or 9.
  if (!/^[6-9]/.test(cleaned)) return false;
  const parsed = parsePhoneNumberFromString(`+91${cleaned}`, IN_REGION);
  return parsed?.isValid() === true;
}

/** Format 10 local digits as "+91 XXXXX XXXXX" for display. */
export function formatIndianMobile(localDigits: string): string {
  const cleaned = digitsOnly(localDigits).slice(0, 10);
  if (cleaned.length <= 5) return `+91 ${cleaned}`;
  return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
}

/** Return E.164 form for a 10-digit Indian local number, or null if invalid. */
export function toE164India(localDigits: string): string | null {
  if (!isValidIndianMobile(localDigits)) return null;
  return `+91${digitsOnly(localDigits)}`;
}

/** Pull the 10 local digits out of an E.164 +91 number. */
export function localDigitsFromE164(e164: string): string {
  if (e164.startsWith('+91')) return e164.slice(3);
  return digitsOnly(e164);
}
