import { Mic, Music2, Guitar, Drum, Piano, Briefcase } from "lucide-react";
import { colorForMember } from "@/lib/conflicts";
import { cn } from "@/lib/utils";

/**
 * Avatar do músico. Se houver foto (data URL), mostra a foto.
 * Senão, círculo colorido (cor estável por id) com um ícone que combina
 * com a função na banda.
 */
export function MemberAvatar({
  member,
  size = 40,
  className,
}: {
  member: {
    id: string;
    nome: string;
    funcao: string;
    avatar?: string | null;
    isManager?: boolean;
  };
  size?: number;
  className?: string;
}) {
  if (member.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar}
        alt={member.nome}
        width={size}
        height={size}
        className={cn(
          "rounded-full object-cover ring-1 ring-border shrink-0",
          className
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  const Icon = member.isManager ? Briefcase : iconForFuncao(member.funcao);
  const c = colorForMember(member.id);
  // tamanho do ícone proporcional ao avatar (≈ 50%)
  const iconSize = Math.round(size * 0.5);
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 ring-1",
        className
      )}
      style={{
        width: size,
        height: size,
        background: c.bg,
        borderColor: c.ring,
        color: c.text,
      }}
      title={member.funcao}
    >
      <Icon style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}

/** Ícone que representa o instrumento/função do músico. */
function iconForFuncao(
  funcao: string
): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  const f = funcao.toLowerCase();
  if (f.includes("vocal") || f.includes("voc") || f.includes("cantor")) return Mic;
  if (f.includes("guitarra") || f.includes("violão") || f.includes("violao") || f.includes("solo") || f.includes("baixo") || f.includes("bass")) return Guitar;
  if (f.includes("bater") || f.includes("drum") || f.includes("percuss")) return Drum;
  if (f.includes("teclad") || f.includes("piano") || f.includes("keys") || f.includes("sintet")) return Piano;
  if (f.includes("manager") || f.includes("gerent") || f.includes("empres")) return Briefcase;
  return Music2;
}
