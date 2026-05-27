import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RegisterForm } from "@/components/auth/register-form";
import { registrationsAllowed } from "@/lib/auth";

export default async function CadastroPage() {
  const allowed = await registrationsAllowed();

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-background py-10">
      <Image
        src="/the-rock-band.jpeg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_25%] opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-transparent to-background/60" />

      <Card className="relative w-full max-w-sm border-border/60 bg-card/85 backdrop-blur-md shadow-2xl shadow-primary/10 ring-1 ring-primary/10">
        <CardHeader className="space-y-3 text-center">
          <div className="relative mx-auto size-16 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A]">
            <Image
              src="/the-rock-logo.png"
              alt="The Rock"
              fill
              sizes="64px"
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-xl">Criar cadastro</CardTitle>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            The Rock
          </p>
        </CardHeader>
        <CardContent>
          {allowed ? (
            <RegisterForm />
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Os cadastros estão fechados no momento. Fale com o
                administrador da banda.
              </p>
              <Button render={<Link href="/login" />} className="w-full">
                Voltar para o login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
