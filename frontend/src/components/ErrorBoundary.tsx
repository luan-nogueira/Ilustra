import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro não tratado na aplicação:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center text-center p-12 bg-[#f8fafc]">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-red-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" className="w-8 h-8">
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Ocorreu um erro inesperado</h2>
          <p className="text-sm text-gray-500 max-w-md leading-relaxed mb-6">
            Algo deu errado ao renderizar esta tela. Você pode tentar recarregar a aplicação — nenhum dado do seu projeto salvo foi perdido.
          </p>
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded-lg text-sm font-medium shadow-sm text-white"
            style={{ background: '#0F62FE' }}
          >
            Recarregar aplicação
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
