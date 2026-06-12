export const otpEmailTemplate = (otp: string, name: string): string => `
  <!DOCTYPE html>
  <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <h2 style="color: #1a1a1a;">Your verification code</h2>
      
      <p style="color: #444;">Hi ${name},</p>
      
      <p style="color: #444;">
        Use the code below to verify your email. 
        It expires in <strong>10 minutes</strong>.
      </p>

      <div style="
        background: #f4f4f4;
        border-radius: 8px;
        padding: 24px;
        text-align: center;
        margin: 32px 0;
      ">
        <span style="
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #1a1a1a;
        ">${otp}</span>
      </div>

      <p style="color: #444;">
        If you didn't request this code, you can safely ignore this email.
      </p>

      <p style="color: #888; font-size: 12px; margin-top: 40px;">
        This code expires in 10 minutes and can only be used once.
      </p>

    </body>
  </html>
`;