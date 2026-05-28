import nodemailer from 'nodemailer';

/**
 * Send an email using nodemailer
 * @param {Object} options - { email, subject, message }
 */
export const sendEmail = async (options) => {
  // Check if email config exists
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('CRITICAL ERROR: Email credentials are not configured in .env file');
    throw new Error('Email service is currently unavailable.');
  }

  // Create a transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  });

  try {
    console.log("---------------- EMAIL DEBUG ----------------");
    console.log("Attempting to send email to:", options.email);
    console.log("Using SMTP User:", process.env.EMAIL_USER);
    
    // Verify connection configuration
    await transporter.verify();
    console.log("SMTP Connection Verified Successfully");

    const mailOptions = {
      from: `"GameOn India" <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email Sent Successfully!");
    console.log("Message ID:", info.messageId);
    console.log("---------------------------------------------");
    return info;
  } catch (error) {
    console.error("---------------- EMAIL ERROR ----------------");
    console.error("Failed to send email to:", options.email);
    console.error("Error Message:", error.message);
    console.error("Error Code:", error.code);
    console.error("Full Error:", error);
    console.error("---------------------------------------------");
    throw error;
  }
};
