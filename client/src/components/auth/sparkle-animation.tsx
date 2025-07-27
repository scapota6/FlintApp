import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface SparkleProps {
  children: React.ReactNode;
  className?: string;
}

export function SparkleAnimation({ children, className = "" }: SparkleProps) {
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    const newSparkles = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2
    }));
    setSparkles(newSparkles);
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
      
      {/* Animated sparkles */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute w-1 h-1 bg-purple-400 rounded-full pointer-events-none"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            delay: sparkle.delay,
            repeat: Infinity,
            repeatDelay: 3
          }}
        />
      ))}
      
      {/* Sliding shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          duration: 2,
          delay: 0.5,
          repeat: Infinity,
          repeatDelay: 4,
          ease: "easeInOut"
        }}
      />
    </div>
  );
}

export function SparkleTitle({ children }: { children: React.ReactNode }) {
  return (
    <SparkleAnimation className="inline-block">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent"
      >
        {children}
      </motion.div>
    </SparkleAnimation>
  );
}