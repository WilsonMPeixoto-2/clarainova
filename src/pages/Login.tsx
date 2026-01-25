import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import { LoadingFallback } from '@/components/LoadingFallback';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const Login = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect to chat if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/chat', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingFallback message="Verificando sessão..." />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Decorative elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2 }}
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center text-center max-w-lg"
      >
        {/* Main Title */}
        <motion.div variants={itemVariants} className="mb-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl leading-tight">
            <span className="block font-light text-foreground/80">
              Inteligência
            </span>
            <span className="block font-bold text-foreground">
              Administrativa
            </span>
          </h1>
        </motion.div>

        {/* CLARA Acronym */}
        <motion.p 
          variants={itemVariants}
          className="text-lg sm:text-xl text-muted-foreground mb-12"
        >
          <span className="text-primary font-medium">C</span>onsultora de{' '}
          <span className="text-primary font-medium">L</span>egislação e{' '}
          <span className="text-primary font-medium">A</span>poio a{' '}
          <span className="text-primary font-medium">R</span>otinas{' '}
          <span className="text-primary font-medium">A</span>dministrativas
        </motion.p>

        {/* Legal Links */}
        <motion.p 
          variants={itemVariants}
          className="text-sm text-muted-foreground mb-4"
        >
          Ao continuar, você concorda com nossa{' '}
          <a 
            href="/privacidade.html" 
            className="text-primary hover:underline font-medium"
          >
            Política de Privacidade
          </a>
          {' '}e{' '}
          <a 
            href="/termos.html" 
            className="text-primary hover:underline font-medium"
          >
            Termos de Uso
          </a>
        </motion.p>

        {/* Google Login Button */}
        <motion.div variants={itemVariants} className="mb-6">
          <GoogleLoginButton />
        </motion.div>

        {/* Divider */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center gap-4 mb-6 w-full max-w-xs"
        >
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-sm text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border/50" />
        </motion.div>

        {/* Continue without login */}
        <motion.button
          variants={itemVariants}
          onClick={() => navigate('/chat')}
          className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          whileHover={{ x: 5 }}
        >
          <span>Continuar sem login</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Benefit text */}
        <motion.p 
          variants={itemVariants}
          className="mt-8 text-sm text-muted-foreground/70 max-w-sm"
        >
          Faça login para salvar seu histórico de conversas e acessar de qualquer dispositivo
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
