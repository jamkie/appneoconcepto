import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "welcome" | "user_updated" | "password_reset";
  to: string;
  userName: string;
  tempPassword?: string;
  changes?: string[];
  resetLink?: string;
}

const getEmailContent = (request: EmailRequest) => {
  const { type, userName, tempPassword, changes, resetLink } = request;

  switch (type) {
    case "welcome":
      return {
        subject: "¡Bienvenido al equipo de Neo Concepto!",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .credentials { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .credentials p { margin: 8px 0; }
              .label { color: #6b7280; font-size: 14px; }
              .value { font-weight: 600; color: #1e3a5f; font-size: 16px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-top: 20px; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">¡Bienvenido al equipo!</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${userName}</strong>,</p>
                <p>Tu cuenta ha sido creada exitosamente en la plataforma de gestión de Neo Concepto.</p>
                
                ${tempPassword ? `
                <div class="credentials">
                  <p class="label">Tu contraseña temporal es:</p>
                  <p class="value">${tempPassword}</p>
                </div>
                <div class="warning">
                  ⚠️ Por seguridad, te recomendamos cambiar esta contraseña después de tu primer inicio de sesión.
                </div>
                ` : ''}
                
                <p style="margin-top: 20px;">Ya puedes acceder a la plataforma con tu correo electrónico.</p>
                <p>¡Estamos emocionados de tenerte en el equipo!</p>
              </div>
              <div class="footer">
                <p>Neo Concepto - 25 años de experiencia en calidad e innovación</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "user_updated":
      return {
        subject: "Tu cuenta ha sido actualizada - Neo Concepto",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .changes { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .changes ul { margin: 0; padding-left: 20px; }
              .changes li { margin: 8px 0; color: #1e3a5f; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Cuenta Actualizada</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${userName}</strong>,</p>
                <p>Un administrador ha realizado cambios en tu cuenta:</p>
                
                <div class="changes">
                  <ul>
                    ${changes?.map(change => `<li>${change}</li>`).join('') || '<li>Permisos actualizados</li>'}
                  </ul>
                </div>
                
                <p>Si tienes alguna pregunta sobre estos cambios, contacta a tu administrador.</p>
              </div>
              <div class="footer">
                <p>Neo Concepto - 25 años de experiencia en calidad e innovación</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "password_reset":
      return {
        subject: "Restablecer contraseña - Neo Concepto",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: #1e3a5f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              .warning { color: #6b7280; font-size: 14px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Restablecer Contraseña</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${userName}</strong>,</p>
                <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
                
                <p style="text-align: center;">
                  <a href="${resetLink}" class="button" style="color: white;">Crear nueva contraseña</a>
                </p>
                
                <p class="warning">
                  Si no solicitaste este cambio, puedes ignorar este correo. El enlace expirará en 1 hora.
                </p>
              </div>
              <div class="footer">
                <p>Neo Concepto - 25 años de experiencia en calidad e innovación</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    default:
      throw new Error("Invalid email type");
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("send-notification-email: request received");

  try {
    const request: EmailRequest = await req.json();
    
    if (!request.to || !request.type || !request.userName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, type, userName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = getEmailContent(request);

    console.log("send-notification-email: sending email", { type: request.type, to: request.to });

    const emailResponse = await resend.emails.send({
      from: "Neo Concepto <onboarding@resend.dev>",
      to: [request.to],
      subject,
      html,
    });

    console.log("send-notification-email: email sent successfully", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-notification-email: error", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
