import camerasCatalog from '../data/cameras.json';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const KEYWORDS_PROJETO = ['porta', 'projeto', 'estacionamento', 'sala', 'ambiente', 'entrada', 'câmera', 'camera'];

// Réplica client-side do fallback roteirizado do backend (backend/main.py::mock_ai_response),
// já que o site estático (GitHub Pages) não tem um servidor de IA no ar.
export function generateAIReply(messages: ChatMessage[]): string {
  const lastMsg = (messages[messages.length - 1]?.content ?? '').toLowerCase();
  const isEstacionamento = lastMsg.includes('estacionamento') || lastMsg.includes('carro') || lastMsg.includes('placa');
  const suggestedCamera = isEstacionamento
    ? camerasCatalog.find(c => c.model.toUpperCase().includes('LPR')) ?? camerasCatalog[0]
    : camerasCatalog[0];

  if (KEYWORDS_PROJETO.some(k => lastMsg.includes(k))) {
    return `Para um controle de acesso completo integrado ao C-CURE 3.10, recomendo a seguinte arquitetura de hardware da Tyco:

- **1x Controladora iSTAR Edge** (Capacidade nativa para 4 leitoras, garantindo controle offline caso o servidor caia)
- **2x Leitoras RM-4** com teclado (Para entrada e saída com dupla autenticação)
- **2x Eletroímãs Magnalock 300kgf**
- **1x ${suggestedCamera.model}** (Resolução ${suggestedCamera.resolution}, alcance de ${suggestedCamera.range}m)${isEstacionamento ? ' com leitura de placas (LPR)' : ' para captura de vídeo atrelada ao evento de acesso'}.

Quer que eu adicione esses equipamentos diretamente na sua planta?

\`\`\`json deploy
{
  "project": "C-CURE 3.10 Access",
  "items": [
    {"type": "controller", "model": "iSTAR Edge", "count": 1},
    {"type": "reader", "model": "Leitora RM-4", "count": 2},
    {"type": "camera", "model": "${suggestedCamera.model}", "count": 1}
  ]
}
\`\`\``;
  }

  return 'Olá! Sou o seu Arquiteto de Soluções IA. Me diga: como é o ambiente que você deseja proteger hoje? Quantas portas de acesso teremos?';
}
