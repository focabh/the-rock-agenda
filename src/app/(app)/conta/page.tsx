import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/conta/change-password-form";
import { MusicoProfile } from "@/components/conta/musico-profile";
import { LogoUploader } from "@/components/conta/logo-uploader";
import { PushManager } from "@/components/conta/push-manager";
import { ProfileSettings } from "@/components/conta/profile-settings";
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
        id: user.member.id,
        nome: user.member.nome,
        funcao: user.member.funcao,
        telefone: user.member.telefone,
        chavePix: user.member.chavePix,
        avatar: user.member.avatar,
        isManager: user.member.isManager,
      }
    : null;

  return (
    <div>
      <PageHeader
        title="Conta"
        description="Sua senha, sua ficha de músico e as configurações do app."
      />
      <div className="p-6 max-w-2xl space-y-6">
        <ProfileSettings
          apelido={user?.apelido ?? null}
          nome={user?.nome ?? null}
          sobrenome={user?.sobrenome ?? null}
        />
        <PushManager />
        <ChangePasswordForm />
        <MusicoProfile member={member} availablePositions={positions} />
        {admin && <LogoUploader currentLogo={logo} />}
      </div>
    </div>
  );
}
