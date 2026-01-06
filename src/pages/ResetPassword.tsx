import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import logoNeoconcepto from '@/assets/logo-neoconcepto.jpg';

const passwordSchema = z.string().min(6, "La contraseña debe tener al menos 6 caracteres");

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Enlace inválido o expirado");
        navigate("/auth");
      }
    };
    checkSession();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast.error("Error al actualizar la contraseña");
    } else {
      setSuccess(true);
      toast.success("Contraseña actualizada exitosamente");
      // Sign out and redirect to login after a delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      }, 2000);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="text-center">
            <img 
              src={logoNeoconcepto} 
              alt="Neo Concepto" 
              className="h-20 w-auto mx-auto mb-4"
            />
          </div>
          
          <Card className="border-0 shadow-neo-lg">
            <CardContent className="py-10">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">¡Contraseña actualizada!</h2>
              <p className="text-muted-foreground text-sm">
                Redirigiendo al inicio de sesión...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <img 
            src={logoNeoconcepto} 
            alt="Neo Concepto" 
            className="h-20 w-auto mx-auto mb-4"
          />
          <p className="text-muted-foreground text-sm">
            Plataforma de Gestión Empresarial
          </p>
        </div>

        <Card className="border-0 shadow-neo-lg">
          <CardHeader className="pb-4 pt-6">
            <h2 className="text-lg font-semibold text-center text-foreground">
              Nueva contraseña
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Ingresa tu nueva contraseña
            </p>
          </CardHeader>
          <CardContent className="pb-6">
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Nueva contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 text-sm font-medium" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Actualizar contraseña
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          25 años de experiencia en calidad e innovación
        </p>
      </div>
    </div>
  );
}
