export const PasswordResetTemplate = (resetUrl: string, name: string): string => `
  <!DOCTYPE html>
  <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">Reset Your Password</h2>
      <p style="color: #444;">Hi ${name},</p>
      <p style="color: #444;">
        We received a request to reset your password.
        This link expires in <strong>30 minutes</strong>.
      </p>
      <div style="
        text-align: center;
        margin: 32px 0;
      ">
        <a href="${resetUrl}" style="
          background: #1a1a1a;
          color: #ffffff;
          padding: 14px 28px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 16px;
          font-weight: bold;
          display: inline-block;
        ">Reset Password</a>
      </div>
      <p style="color: #444;">
        If you didn't request this, you can safely ignore this email — your password will remain unchanged.
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 40px;">
        This link expires in 30 minutes and can only be used once.
      </p>
    </body>
  </html>
`;