import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Log para debugging local
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Log para analytics via edge function (sem dados sensíveis) - fire and forget
    this.logErrorToAnalytics(error, errorInfo);
  }
  
  private async logErrorToAnalytics(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (!supabaseUrl || !anonKey) return;
      
      await fetch(`${supabaseUrl}/functions/v1/log-frontend-error`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          error_message: error.message?.slice(0, 500) || "Unknown error",
          component_stack: errorInfo.componentStack?.slice(0, 1000) || null,
          url: window.location.pathname,
        }),
      });
    } catch {
      // Silently fail - não impactar UX por falha de logging
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center animate-fade-in">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-10 h-10 text-destructive" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Algo deu errado
              </h1>
              <p className="text-muted-foreground">
                Desculpe, ocorreu um erro inesperado. Nossa equipe foi notificada.
              </p>
            </div>

            {/* Error details (development only) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Detalhes técnicos
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border overflow-auto max-h-40">
                  <pre className="text-xs text-destructive font-mono whitespace-pre-wrap">
                    {this.state.error.message}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-muted-foreground font-mono mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Tentar novamente
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="gap-2"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Página inicial
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC para usar com componentes funcionais
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
