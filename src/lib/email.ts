const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const APP_URL = process.env.APP_URL ?? "https://therockbh.vercel.app";

type NewSignup = {
  nome?: string | null;
  username: string;
  email?: string | null;
  telefone?: string | null;
  chavePix?: string | null;
  posicao?: string | null;
};

/**
 * Avisa o admin por email que há um cadastro pendente.
 * No-op silencioso se RESEND_API_KEY / ADMIN_EMAIL não estiverem configurados,
 * para o cadastro funcionar mesmo sem email configurado.
 */
export async function sendRegistrationNotification(novo: NewSignup): Promise<void> {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    console.log("[email] RESEND_API_KEY/ADMIN_EMAIL ausente — pulando envio");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "The Rock <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `Novo cadastro pendente: ${novo.nome ?? novo.username}`,
        html: `
          <h2>Novo cadastro aguardando aprovação</h2>
          <ul>
            <li><strong>Nome:</strong> ${novo.nome ?? "—"}</li>
            <li><strong>Usuário:</strong> ${novo.username}</li>
            <li><strong>Posição:</strong> ${novo.posicao ?? "—"}</li>
            <li><strong>Email:</strong> ${novo.email ?? "—"}</li>
            <li><strong>Telefone:</strong> ${novo.telefone ?? "—"}</li>
            <li><strong>Chave PIX:</strong> ${novo.chavePix ?? "—"}</li>
          </ul>
          <p><a href="${APP_URL}/cadastros">Aprovar ou recusar no painel →</a></p>
        `,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend respondeu", res.status, await res.text());
    }
  } catch (e) {
    console.error("[email] erro ao enviar:", e);
  }
}
