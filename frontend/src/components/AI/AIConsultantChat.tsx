import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AIConsultantChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou o seu Arquiteto de Soluções IA. Me diga: como é o ambiente que você deseja proteger hoje? Quantas portas de acesso teremos?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const newMsgs = [...messages, { role: 'user', content: input } as Message];
    setMessages(newMsgs);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/v1/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs })
      });
      const data = await res.json();
      setMessages([...newMsgs, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Erro ao contatar o servidor da IA.' }]);
    }
    
    setIsLoading(false);
  };

  const handleDeploy = (jsonStr: string) => {
    try {
      const project = JSON.parse(jsonStr);
      let alertMsg = `Aplicando Projeto: ${project.project}\n`;
      let added = 0;
      project.items.forEach((item: any) => {
        for(let i=0; i<item.count; i++) {
           const type: any = ['camera', 'reader', 'controller'].includes(item.type) ? item.type : 'column';
           const color = item.type === 'camera' ? '#3b82f6' : (item.type === 'reader' ? '#10b981' : '#f59e0b');
           
           useProjectStore.getState().addSceneObject({
              id: uuidv4(),
              type: type,
              position: [(Math.random() - 0.5) * 4, 0.1, (Math.random() - 0.5) * 4],
              rotation: [0, 0, 0],
              scale: type === 'camera' ? [1,1,1] : [1, 1, 1],
              color: color,
              fov: 90,
              range: 10,
              model: item.model
           } as any);
           added++;
        }
        alertMsg += `- ${item.count}x ${item.model}\n`;
      });
      alert(alertMsg + `\n${added} equipamentos adicionados ao mapa! (Veja no centro da planta)`);
    } catch(e) {
      alert("Erro ao aplicar o projeto.");
    }
  };

  const renderMessageContent = (content: string) => {
    if (content.includes('```json deploy')) {
      const parts = content.split('```json deploy');
      const beforeText = parts[0];
      const afterPart = parts[1].split('```');
      const jsonStr = afterPart[0];
      const afterText = afterPart[1] || '';
      
      let parsed = null;
      try {
        parsed = JSON.parse(jsonStr);
      } catch(e) {}
      
      return (
        <div>
          <p style={{ margin: '0 0 8px 0', whiteSpace: 'pre-wrap' }}>{beforeText}</p>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: 8, padding: 12, margin: '8px 0' }}>
             <h4 style={{ margin: '0 0 8px 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}>
               <span>📦</span> {parsed?.project || 'Receita de Equipamentos'}
             </h4>
             
             {parsed && parsed.items && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                 {parsed.items.map((item: any, idx: number) => (
                   <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.4)', padding: '6px 10px', borderRadius: 6 }}>
                     <span style={{ fontSize: 12, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                       {item.type === 'camera' ? '📷' : item.type === 'reader' ? '🪪' : '🎛️'} {item.model}
                     </span>
                     <span style={{ fontSize: 12, fontWeight: 'bold', color: '#38bdf8' }}>x{item.count}</span>
                   </div>
                 ))}
               </div>
             )}
             
             <button onClick={() => handleDeploy(jsonStr)} style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
             >
               <span>✨</span> Aplicar Equipamentos na Planta
             </button>
          </div>
          <p style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{afterText}</p>
        </div>
      );
    }
    return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{ position: 'fixed', bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32, background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: '#fff', border: 'none', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, zIndex: 9999 }}
      >
        🤖
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, width: 380, height: 600, background: '#1e293b', borderRadius: 16, border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9999 }}>
      <div style={{ background: 'linear-gradient(to right, #8b5cf6, #3b82f6)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>Arquiteto IA</h3>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: 12 }}>Especialista em Controle de Acesso</p>
            </div>
         </div>
         <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, background: '#0f172a' }}>
         {messages.map((m, i) => (
           <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
             <div style={{ maxWidth: '85%', background: m.role === 'user' ? '#3b82f6' : '#1e293b', border: m.role === 'user' ? 'none' : '1px solid #334155', padding: '10px 14px', borderRadius: 12, borderBottomRightRadius: m.role === 'user' ? 0 : 12, borderBottomLeftRadius: m.role === 'user' ? 12 : 0, color: '#f1f5f9', fontSize: 14, lineHeight: 1.5 }}>
               {renderMessageContent(m.content)}
             </div>
           </div>
         ))}
         {isLoading && (
           <div style={{ alignSelf: 'flex-start', background: '#1e293b', border: '1px solid #334155', padding: '10px 14px', borderRadius: 12, color: '#94a3b8', fontSize: 14 }}>
             Pensando...
           </div>
         )}
         <div ref={endRef} />
      </div>

      <div style={{ padding: 16, background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', gap: 10 }}>
         <input 
           value={input}
           onChange={e => setInput(e.target.value)}
           onKeyDown={e => e.key === 'Enter' && handleSend()}
           placeholder="Ex: Sala com 2 portas, alto risco..."
           style={{ flex: 1, background: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '10px 12px', color: '#f1f5f9', outline: 'none' }}
         />
         <button 
           onClick={handleSend}
           disabled={isLoading || !input.trim()}
           style={{ background: '#3b82f6', border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', cursor: 'pointer', opacity: (isLoading || !input.trim()) ? 0.5 : 1 }}
         >
           Enviar
         </button>
      </div>
    </div>
  );
};
