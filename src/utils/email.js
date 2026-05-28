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
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
  });

  // Define email options
  const mailOptions = {
    from: `"GameOn India" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  // Actually send the email
  try {
    console.log("Attempting to send email to:", options.email);
    console.log("Using Host:", process.env.EMAIL_HOST || 'smtp.gmail.com');
    console.log("Using Port:", process.env.EMAIL_PORT || 587);
    console.log("Using User:", process.env.EMAIL_USER);

    // Verify connection configuration
    await transporter.verify();
    console.log("Server is ready to take our messages");

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully! MessageId: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Nodemailer error details:", error);
    throw error;
  }
};
