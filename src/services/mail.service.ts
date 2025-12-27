import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
}

export class MailService {
    private transporter: nodemailer.Transporter | null = null;

    constructor() {
        this.initializeTransporter();
    }

    private async initializeTransporter() {
        const config = await this.getSmtpConfig();
        if (config) {
            this.transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.secure,
                auth: {
                    user: config.user,
                    pass: config.pass,
                },
            });
        }
    }

    async getSmtpConfig(): Promise<SmtpConfig | null> {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from']
                }
            }
        });

        if (settings.length === 0) return null;

        const config: any = {};
        settings.forEach(s => {
            config[s.key.replace('smtp_', '')] = s.value;
        });

        // Type conversion
        if (config.port) config.port = parseInt(config.port, 10);
        if (config.secure) config.secure = config.secure === 'true';

        if (!config.host || !config.port || !config.user || !config.pass || !config.from) {
            return null;
        }

        return config as SmtpConfig;
    }

    async updateSmtpConfig(config: SmtpConfig) {
        const updates = [
            prisma.setting.upsert({ where: { key: 'smtp_host' }, update: { value: config.host }, create: { key: 'smtp_host', value: config.host } }),
            prisma.setting.upsert({ where: { key: 'smtp_port' }, update: { value: config.port.toString() }, create: { key: 'smtp_port', value: config.port.toString() } }),
            prisma.setting.upsert({ where: { key: 'smtp_secure' }, update: { value: config.secure.toString() }, create: { key: 'smtp_secure', value: config.secure.toString() } }),
            prisma.setting.upsert({ where: { key: 'smtp_user' }, update: { value: config.user }, create: { key: 'smtp_user', value: config.user } }),
            prisma.setting.upsert({ where: { key: 'smtp_pass' }, update: { value: config.pass }, create: { key: 'smtp_pass', value: config.pass } }),
            prisma.setting.upsert({ where: { key: 'smtp_from' }, update: { value: config.from }, create: { key: 'smtp_from', value: config.from } }),
        ];

        await prisma.$transaction(updates);
        await this.initializeTransporter();
    }

    async sendMail(to: string, subject: string, html: string) {
        if (!this.transporter) {
            await this.initializeTransporter();
            if (!this.transporter) {
                throw new Error('SMTP not configured');
            }
        }

        const config = await this.getSmtpConfig();
        if (!config) throw new Error('SMTP config missing');

        await this.transporter.sendMail({
            from: config.from,
            to,
            subject,
            html,
        });
    }
}

export const mailService = new MailService();
