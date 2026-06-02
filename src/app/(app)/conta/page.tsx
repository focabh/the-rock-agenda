import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/conta/change-password-form";
import { MusicoProfile } from "@/components/conta/musico-profile";
import { LogoUploader } from "@/components/conta/logo-uploader";
import { PushManager } from "@/components/conta/push-manager";
import { ProfileSettings } from "@/components/conta/profile-settings";
import { MaterialPrefToggle } from "@/components/conta/material-pref-toggle";
import { BrandSettings } from "@/components/conta/brand-settings";
import { BackgroundCard } from "@/components/conta/background-card";
import { SurfaceCard } from "@/components/conta/surface-card";
import { UpdateAppButton } from "@/components/conta/update-app-button";
import { NotifyCard } from "@/components/conta/notify-card";
import { SpotifyListsCard } from "@/components/conta/spotify-lists-card";
import {
  adminMaterialPorPosicao,
  getAvailablePositions,
  getBrand,
  getCurrentUser,
  getLogoUrl,
  isAdmin,
  isSuperuser,
} from "@/lib/auth";

export default async function ContaPage() {
  const user = await getCurrentUser();
  const superuser = isSuperuser(user);
  const admin = isAdmin(user);
  const [logo, positions, matPorPosicao, brand] = await Promise.all([
    getLogoUrl(),
    getAvailablePositions(),
    adminMaterialPorPosicao(),
    getBrand(),
  ]);

  const member = user?.member
    ? {
        id: user.member.id,
        nome: user.member.nome,
        funcao: user.member.funcao,
        telefone: user.member.telefone,
        chavePix: user.member.chavePix,
        pixTipo: user.member.pixTipo,
        pixBanco: user.member.pixBanco,
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
          username={user?.username ?? ""}
          apelido={user?.apelido ?? null}
          nome={user?.nome ?? null}
          sobrenome={user?.sobrenome ?? null}
        />
        <PushManager />
        {admin && <NotifyCard />}
        <UpdateAppButton canBroadcast={superuser} />
        <ChangePasswordForm />
        <MusicoProfile member={member} availablePositions={positions} />
        {superuser && <MaterialPrefToggle initial={matPorPosicao} />}
        {superuser && (
          <BrandSettings
            initialName={brand.bandName ?? ""}
            initialGrupo={brand.whatsappGrupo ?? ""}
            initialGrupoMusicos={brand.whatsappGrupoMusicos ?? ""}
          />
        )}
        {superuser && (
          <SpotifyListsCard
            repertorio={brand.spotifyListRepertorio ?? ""}
            setlist={brand.spotifyListSetlist ?? ""}
            ensaio={brand.spotifyListEnsaio ?? ""}
          />
        )}
        {superuser && <LogoUploader currentLogo={logo} />}
        {superuser && (
          <BackgroundCard
            kind="login"
            initial={brand.backgroundUrl}
            titulo="Fundo da tela de login"
            hint="Aparece atrás do formulário de acesso. Sem imagem, fundo escuro neutro."
          />
        )}
        {superuser && (
          <BackgroundCard
            kind="app"
            initial={brand.appBackgroundUrl}
            titulo="Fundo geral do app"
            hint="Aparece em todas as telas internas, atrás do conteúdo. O layout continua igual."
          />
        )}
        {superuser && <SurfaceCard initial={brand.surfaceOpacity} />}
      </div>
    </div>
  );
}
