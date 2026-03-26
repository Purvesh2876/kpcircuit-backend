const nodeMailer = require("nodemailer");

const sendEmail = async (options) => {
  if (!options.email) {
    console.warn("Email notification skipped: No recipient defined.");
    return;
  }

  // Configure Nodemailer
  const transporter = nodeMailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'prxdevs@gmail.com',
      pass: 'bkex wcgu jswu hbtj',
    },
  });

  const mailOptions = {
    from: process.env.SMPT_MAIL || 'prxdevs@gmail.com',
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending email:', error.message);
    // We don't throw here to avoid crashing the main process for a failed notification
  }
};

module.exports = sendEmail;
