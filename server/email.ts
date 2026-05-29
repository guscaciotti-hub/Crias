import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM ?? "AtendêAI <noreply@atendeai.com.br>";

export async function sendVerificationEmail(to: string, name: string, code: string) {
  const transport = createTransport();
  if (!transport) {
    console.log(`[Email] SMTP not configured — verification code for ${to}: ${code}`);
    return;
  }
  await transport.sendMail({
    from: FROM,
    to,
    subject: `${code} é seu código AtendêAI`,
    html: emailHtml({
      title: "Confirme seu e-mail",
      preheader: `Seu código de verificação é ${code}`,
      body: `
        <p style="margin:0 0 16px">Olá, <strong>${name}</strong>!</p>
        <p style="margin:0 0 24px">Use o código abaixo para confirmar seu e-mail e ativar sua conta:</p>
        <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#18181b">${code}</span>
        </div>
        <p style="margin:0 0 8px;color:#71717a;font-size:14px">O código expira em <strong>15 minutos</strong>.</p>
        <p style="margin:0;color:#71717a;font-size:14px">Se você não criou uma conta, ignore este e-mail.</p>
      `,
    }),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, code: string) {
  const transport = createTransport();
  if (!transport) {
    console.log(`[Email] SMTP not configured — password reset code for ${to}: ${code}`);
    return;
  }
  await transport.sendMail({
    from: FROM,
    to,
    subject: `${code} — Redefinição de senha AtendêAI`,
    html: emailHtml({
      title: "Redefinir senha",
      preheader: `Seu código de redefinição de senha é ${code}`,
      body: `
        <p style="margin:0 0 16px">Olá, <strong>${name}</strong>!</p>
        <p style="margin:0 0 24px">Recebemos uma solicitação para redefinir a senha da sua conta. Use o código abaixo:</p>
        <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#18181b">${code}</span>
        </div>
        <p style="margin:0 0 8px;color:#71717a;font-size:14px">O código expira em <strong>15 minutos</strong>.</p>
        <p style="margin:0;color:#71717a;font-size:14px">Se você não solicitou isso, ignore este e-mail — sua senha permanece a mesma.</p>
      `,
    }),
  });
}

function emailHtml({ title, preheader, body }: { title: string; preheader: string; body: string }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <span style="display:none;max-height:0;overflow:hidden">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden">
        <tr>
          <td style="background:#18181b;padding:24px 32px">
            <span style="font-size:20px;font-weight:700;color:#ffffff">AtendêAI</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#18181b">${title}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f4f4f5">
            <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center">
              © ${new Date().getFullYear()} AtendêAI · Todos os direitos reservados
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
