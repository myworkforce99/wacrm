/**
 * Social account token encryption/decryption.
 *
 * Delegates to the same AES-GCM helpers already used by
 * src/lib/whatsapp/encryption.ts. Import that module's
 * `encrypt` and `decrypt` directly — do NOT duplicate the
 * cipher logic here. This file is a thin adapter that names
 * the domain clearly so callers stay readable.
 */
export {
  encrypt as encryptToken,
  decrypt as decryptToken,
} from '@/lib/whatsapp/encryption';
