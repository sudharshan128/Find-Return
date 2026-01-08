import speakeasy from "speakeasy";
import { v4 as uuidv4 } from "uuid";

/**
 * 2FA Service using TOTP (Time-based One-Time Password)
 * CRITICAL: Only super_admin users require 2FA
 * Standard admins bypass this layer automatically
 */
export class TwoFAService {
  private totpWindow = parseInt(process.env.TOTP_WINDOW || "2");

  /**
   * Generate a new 2FA secret for setup
   * Returns secret and QR code data URL
   */
  generateSecret(adminEmail: string): {
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
  } {
    const secret = speakeasy.generateSecret({
      name: `Trust Lost & Found (${adminEmail})`,
      issuer: "Trust",
      length: 32,
    });

    if (!secret.base32 || !secret.otpauth_url) {
      throw new Error("Failed to generate TOTP secret");
    }

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url,
      manualEntryKey: secret.base32,
    };
  }

  /**
   * Verify TOTP code
   * CRITICAL: Uses configurable window for clock skew
   * Default: 30-second window with ±2 steps = 90 seconds total tolerance
   */
  verifyToken(secret: string, token: string): boolean {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: token,
        window: this.totpWindow,
      });

      return verified;
    } catch (error) {
      console.error("[2FA] Token verification error:", error);
      return false;
    }
  }

  /**
   * Generate backup codes (optional, for future enhancement)
   * Currently not implemented - can be added in Phase 4
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      codes.push(
        uuidv4()
          .replace(/-/g, "")
          .substring(0, 8)
          .toUpperCase()
      );
    }
    return codes;
  }
}

// Export singleton
export const twoFAService = new TwoFAService();
