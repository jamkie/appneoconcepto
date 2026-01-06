import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random password
const generatePassword = (length = 12): string => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("create-user: request", { method: req.method });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the authorization header to verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    // Admin client with service role (used for verifying caller + creating user)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (callerError || !callerUser) {
      console.log("create-user: unauthorized", { callerError: callerError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if caller is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (roleError) {
      return new Response(
        JSON.stringify({ error: "Error checking permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request body
    const { email, password, fullName, role, moduleIds, isSeller, generateTempPassword } = await req.json();

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use provided password or generate one
    const userPassword = generateTempPassword ? generatePassword() : password;

    if (!userPassword) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create user with admin API (doesn't affect caller's session)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = authData.user.id;

    // Assign role
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: role === "admin" ? "admin" : "user",
    });

    // Assign module permissions (non-admin)
    if (role !== "admin" && moduleIds && moduleIds.length > 0) {
      const insertData = moduleIds.map((moduleId: string) => ({
        user_id: newUserId,
        module_id: moduleId,
        created_by: callerUser.id,
      }));
      await supabaseAdmin.from("user_module_permissions").insert(insertData);
    }

    // Create seller record if requested (admins can also be sellers)
    if (isSeller) {
      await supabaseAdmin.from("sellers").insert({
        name: fullName,
        email: email,
        user_id: newUserId,
      });
    }

    // Send welcome email
    console.log("create-user: sending welcome email");
    try {
      await resend.emails.send({
        from: "Neo Concepto <onboarding@resend.dev>",
        to: [email],
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
                <p>Hola <strong>${fullName}</strong>,</p>
                <p>Tu cuenta ha sido creada exitosamente en la plataforma de gestión de Neo Concepto.</p>
                
                ${generateTempPassword ? `
                <div class="credentials">
                  <p class="label">Tu contraseña temporal es:</p>
                  <p class="value">${userPassword}</p>
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
      });
      console.log("create-user: welcome email sent");
    } catch (emailError) {
      console.error("create-user: failed to send welcome email", emailError);
      // Don't fail the entire operation if email fails
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
