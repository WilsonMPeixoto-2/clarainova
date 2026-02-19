import { ReactNode, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

const ScrollReveal = ({ children, delay = 0, className = '' }: ScrollRevealProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [jsEnabled, setJsEnabled] = useState(false);

  useEffect(() => {
    setJsEnabled(document.body.classList.contains('js-enabled'));
  }, []);

  if (prefersReducedMotion || !jsEnabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.62,
        delay: delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
};

export default ScrollReveal;
