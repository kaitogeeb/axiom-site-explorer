import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Zap, Shield, BarChart3, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MarketMaking = () => {
  const navigate = useNavigate();
  const [activeMarketMakers, setActiveMarketMakers] = useState(5456);

  useEffect(() => {
    // Base date: January 6, 2026
    const baseDate = new Date('2026-01-06T00:00:00');
    
    const updateCounter = () => {
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60));
      // Add 1 for every 2 minutes
      const increment = Math.floor(diffInMinutes / 2);
      // Ensure we don't go below base if date is before base (unlikely given prompt context)
      setActiveMarketMakers(5456 + Math.max(0, increment));
    };

    updateCounter();
    const interval = setInterval(updateCounter, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Zap className="w-8 h-8 text-yellow-400" />,
      title: "Instant Liquidity",
      description: "Automated provisioning to ensure your token is always tradable with minimal slippage."
    },
    {
      icon: <Shield className="w-8 h-8 text-blue-400" />,
      title: "Secure & Non-Custodial",
      description: "Smart contract based market making that keeps your treasury funds safe and under your control."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-green-400" />,
      title: "Volume Generation",
      description: "Organic volume generation strategies to maintain healthy chart activity and visibility."
    },
    {
      icon: <Rocket className="w-8 h-8 text-purple-400" />,
      title: "Launch Support",
      description: "Comprehensive support for token launches, from initial liquidity to long-term stability."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      <Navigation />
      
      <div className="container mx-auto px-4 py-24 relative z-10">
        <div className="text-center mb-16">
          <motion.h1 
            className="text-5xl md:text-7xl font-extrabold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 animate-pulse">
              Liquicore
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-xl text-muted-foreground mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Institutional-Grade Market Making for Every Project
          </motion.p>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="inline-block"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-12 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="text-6xl font-mono font-bold text-white mb-2">
                {activeMarketMakers.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">
                Active Market Makers
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + (index * 0.1) }}
            >
              <Card className="h-full bg-card/30 border-white/5 hover:bg-card/50 transition-colors duration-300">
                <div className="p-6">
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold mb-2 text-white">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-lg px-8 py-6 rounded-full shadow-lg shadow-purple-500/25 hover:shadow-purple-500/50 transition-all duration-300"
              onClick={() => navigate('/ads?boost=true')}
            >
              Boost Your Project Now
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Background Elements */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[128px]" />
      </div>
    </div>
  );
};

export default MarketMaking;
