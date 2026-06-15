import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetForm } from "@/components/auth/reset-form";
import { getBrand } from "@/lib/auth";

export default async function RecuperarPage() {
  const { logoUrl, backgroundUrl, bandName } = await getBrand();
  const nome = bandName?.trim() || "StageBoss";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-[#09090b]">
      {backgroundUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 50% -10%, rgba(220,38,38,0.12), transparent 55%), repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 6px)",
          }}
        />
      )}

      <Card className="relative w-full max-w-sm border-zinc-800 bg-[#18181b]/90 backdrop-blur-md shadow-2xl shadow-black/40">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-20 items-center justify-center overflow-hidden rounded-xl ring-1 ring-zinc-700">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={nome} className="size-full object-contain" />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-br from-red-600 to-red-800 text-2xl font-black tracking-tighter text-white">
                S<span className="text-amber-400">B</span>
              </div>
            )}
          </div>
          <CardTitle className="text-xl text-zinc-100">Redefinir senha</CardTitle>
          <p className="text-xs uppercase tracking-widest text-zinc-400">
            {nome}
          </p>
        </CardHeader>
        <CardContent>
          <ResetForm />
        </CardContent>
      </Card>
    </div>
  );
}
