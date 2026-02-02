import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página não encontrada</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Voltar para o início
        </a>
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-muted-foreground/50">
            Desenvolvido por Wilson M. Peixoto - SME/RJ
          </p>
          <p className="text-xs text-muted-foreground/40">
            📞 (21) 99497-4132 • 📧 wilsonmp2@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
