import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getLogoUrl } from "@/lib/auth";

export default async function LoginPage() {
  const logo = await getLogoUrl();

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-background">
      {/* Foto da banda como hero de fundo */}
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
          <div className="mx-auto size-20 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="The Rock" className="size-full object-contain" />
          </div>
          <CardTitle className="text-xl">The Rock — Operações</CardTitle>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Acesso interno
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
