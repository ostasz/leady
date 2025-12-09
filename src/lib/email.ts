import nodemailer from 'nodemailer';

interface EmailPayload {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

const smtpOptions = {
    host: process.env.SMTP_HOST || 'ssl0.ovh.net',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
};

export const sendEmail = async (data: EmailPayload) => {
    const transporter = nodemailer.createTransport({
        ...smtpOptions,
    });

    return await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        ...data,
    });
};
