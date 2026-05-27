import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/conta/change-password-form";
import { LogoUploader } from "@/components/conta/logo-uploader";
import { getCurrentUser, getLogoUrl, isAdmin } from "@/lib/auth";

export default async function ContaPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const logo = await getLogoUrl();

  return (
    <div>
      <PageHeader
        title="Conta"
        description="Sua senha e as configurações do app."
      />
      <div className="p-6 max-w-2xl space-y-6">
        <ChangePasswordForm />
        {admin && <LogoUploader currentLogo={logo} />}
      </div>
    </div>
  );
}
