/* Email service wrapper for templated and plain emails. */
var nodemailer = require("nodemailer");
var Email = require("email-templates");

module.exports = {
  // Send templated email using Pug templates in src/views/emails
  sendMail: async (toEmail, mailSubject, templateName, locale) => {
    if (process.env.SEND_EMAIL === "true") {
      try {
        const configOption = {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT),
          secureConnection: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
          tls: {
            ciphers: "SSLv3",
          },
        };
        const viewPath = "src/views/emails";
        const transporter = nodemailer.createTransport(configOption);
        const email = new Email({
          transport: transporter,
          send: true,
          preview: false,
          views: {
            options: {
              extension: "pug",
            },
            root: viewPath,
          },
        });
        console.log("process.env.COMPANY_EMAIL", process.env.COMPANY_EMAIL);
        // Send mail with template variables in locals
        const info = await email.send({
          template: templateName,
          message: {
            from: `${process.env.COMPANY_EMAIL}`,
            to: toEmail,
            subject: mailSubject,
          },
          locals: locale,
        });
        if (info) {
          console.log("Message sent: %s", info.messageId);
        }
        return info;
      } catch (error) {
        console.log(error, "mailer error");
        return null;
      }
    } else {
      return true;
    }
  },
  // Send plain-text email using SMTP
  sendSimpleMail: async (toEmail, mailSubject, text) => {
    if (process.env.SEND_EMAIL === "true") {
      try {
        const configOption = {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT),
          secureConnection: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
          tls: {
            ciphers: "SSLv3",
          },
        };

        const transporter = nodemailer.createTransport(configOption);
        const info = await transporter.sendMail({
          from: `${process.env.COMPANY_EMAIL}`,
          to: toEmail,
          subject: mailSubject,
          text,
        });
        if (info) {
          console.log("Message sent: %s", info.messageId);
        }
        return info;
      } catch (error) {
        console.log(error, "mailer error");
        return null;
      }
    } else {
      return true;
    }
  },
};
