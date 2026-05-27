import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/conta/change-password-form";
import { MusicoProfile } from "@/components/conta/musico-profile";
import { LogoUploader } from "@/components/conta/logo-uploader";
import {
  getAvailablePositions,
  getCurrentUser,
  getLogoUrl,
  isAdmin,
} from "@/lib/auth";

export default async function ContaPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const [logo, positions] = await Promise.all([
    getLogoUrl(),
    getAvailablePositions(),
  ]);

  const member = user?.member
    ? {
        nome: user.member.nome,
        funcao: user.member.funcao,
        telefone: user.member.telefone,
        chavePix: user.member.chavePix,
      }
    : null;

  return (
    <div>
      <PageHeader
        title="Conta"
        description="Sua senha, sua ficha de músico e as configurações do app."
      />
      <div className="p-6 max-w-2xl space-y-6">
        <ChangePasswordForm />
        <MusicoProfile member={member} availablePositions={positions} />
        {admin && <LogoUploader currentLogo={logo} />}
      </div>
    </div>
  );
}
