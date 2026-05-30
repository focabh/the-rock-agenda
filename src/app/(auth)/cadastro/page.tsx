import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RegisterForm } from "@/components/auth/register-form";
import { getAvailablePositions, getLogoUrl } from "@/lib/auth";
import { getValidInvite } from "@/lib/invites";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: inviteToken } = await searchParams;

  const [invite, positions, logo] = await Promise.all([
    getValidInvite(inviteToken),
    getAvailablePositions(),
    getLogoUrl(),
  ]);
  // Com posição travada no convite, não dependemos da lista de posições livres.
  const canRegister =
    Boolean(invite) && (Boolean(invite?.posicao) || positions.length > 0);

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
          <div className="mx-auto size-16 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="The Rock" className="size-full object-contain" />
          </div>
          <CardTitle className="text-xl">Criar cadastro</CardTitle>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            The Rock
          </p>
        </CardHeader>
        <CardContent>
          {canRegister ? (
            <RegisterForm
              availablePositions={positions}
              inviteToken={invite!.token}
              lockedTelefone={invite!.telefone}
              defaultNome={invite!.nome ?? ""}
              lockedPosicao={invite!.posicao ?? ""}
            />
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {!invite
                  ? "O cadastro na The Rock é só por convite. Peça um link ao administrador da banda — o convite pode ter expirado ou já ter sido usado."
                  : "Todas as posições da banda já têm cadastro. Fale com o administrador."}
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
