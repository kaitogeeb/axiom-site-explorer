import { motion } from 'framer-motion';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Zap, Shield, Route, Eye, CheckCircle, Lock, Gauge, Smartphone } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import pegasusLogo from '@/assets/pegasus-logo.png';

const WhyPegasus = () => {
  const { connect } = useWallet();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-14 md:pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            <motion.img
              src={pegasusLogo}
              alt="Pegasus"
              className="w-32 h-32 mx-auto"
              animate={{
                y: [0, -10, 0],
                filter: [
                  'drop-shadow(0 0 20px hsl(195 100% 60% / 0.6))',
                  'drop-shadow(0 0 40px hsl(195 100% 60% / 0.8))',
                  'drop-shadow(0 0 20px hsl(195 100% 60% / 0.6))'
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            <h1 className="text-4xl md:text-6xl font-extrabold text-gradient">
              Why Pegasus Swap
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              Blazing-fast Solana swaps with a wallet-first, transparent experience.
            </p>

            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <p className="text-base md:text-lg">Sub-second quotes and low fees powered by Solana.</p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <p className="text-base md:text-lg">Wallet-first UX with secure, multi-wallet support.</p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <p className="text-base md:text-lg">Transparent routes, clear fees, and real-time status.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <ConnectWalletButton />
              <Button variant="outline" size="lg" className="border-primary/50 hover:bg-primary/10">
                Explore Routes
              </Button>
            </div>

            <p className="text-sm text-muted-foreground pt-4">
              Non-custodial. You control your assets.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Value Proposition Cards */}
      <section className="py-14 md:py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass-card h-full hover:glow-effect transition-all">
                <CardHeader>
                  <Zap className="w-12 h-12 text-primary mb-4" />
                  <CardTitle className="text-xl md:text-2xl">Speed & Low Fees</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm md:text-base">
                    Solana's high throughput enables sub-second quotes and low transaction costs, designed for rapid swapping without sacrificing reliability.
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-card h-full hover:glow-effect transition-all">
                <CardHeader>
                  <Shield className="w-12 h-12 text-secondary mb-4" />
                  <CardTitle className="text-xl md:text-2xl">Wallet-First UX</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm md:text-base">
                    Connect with popular Solana wallets and swap seamlessly. Session handling, network awareness, and clear states keep you in control.
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card h-full hover:glow-effect transition-all">
                <CardHeader>
                  <Route className="w-12 h-12 text-accent mb-4" />
                  <CardTitle className="text-xl md:text-2xl">Transparent Routes</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm md:text-base">
                    Preview best-available routes, see expected output, fees, and slippage at a glance. No hidden steps or gotchas.
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              <Card className="glass-card h-full hover:glow-effect transition-all">
                <CardHeader>
                  <Eye className="w-12 h-12 text-primary mb-4" />
                  <CardTitle className="text-xl md:text-2xl">Safety & Reliability</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm md:text-base">
                    Client-side validation catches errors early. Explicit confirmations and status feedback keep every action clear and auditable.
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-14 md:py-20 px-4 bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gradient mb-4">How Pegasus Swap Works</h2>
          </motion.div>

          <div className="space-y-4">
            {[
              "Connect your wallet.",
              "Choose the tokens to swap.",
              "Enter your amount.",
              "Get the best route and review fees.",
              "Confirm the transaction.",
              "Track status in real-time."
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 glass-card p-4 sm:p-6 rounded-xl"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center font-bold text-xl flex-shrink-0">
                  {index + 1}
                </div>
                <p className="text-base md:text-lg">{step}</p>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-muted-foreground mt-8">
            Everything is non-custodial — we never take possession of your assets.
          </p>
        </div>
      </section>

      {/* Performance Stats */}
      <section className="py-14 md:py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Gauge, label: "Real-time quotes", value: "Sub-second target" },
              { icon: Zap, label: "Low fees", value: "Optimized for Solana" },
              { icon: Shield, label: "High reliability", value: "Clear error handling" },
              { icon: Smartphone, label: "Mobile-ready", value: "Designed for any device" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="glass-card text-center hover:glow-effect transition-all">
                  <CardContent className="pt-5 md:pt-6 pb-5 md:pb-6">
                    <stat.icon className="w-10 h-10 mx-auto mb-4 text-primary" />
                    <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Deep Dive */}
      <section className="py-14 md:py-20 px-4 bg-muted/20">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gradient mb-4">Built for Speed, Trust, and Clarity</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: Shield,
                title: "Wallet Integration",
                description: "Effortless connect/disconnect, multi-wallet support, and clear session states make swapping intuitive and secure."
              },
              {
                icon: CheckCircle,
                title: "Validation & Forms",
                description: "Client-side schema validation and safe forms help prevent invalid inputs and give you immediate feedback."
              },
              {
                icon: Zap,
                title: "Real-Time Data",
                description: "Quotes, balances, and statuses refresh automatically with smart caching and retries to keep information up-to-date."
              },
              {
                icon: Eye,
                title: "Accessible Design",
                description: "Keyboard-friendly interactions, sensible focus states, and readable components ensure everyone can swap confidently."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4"
              >
                <feature.icon className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm md:text-base text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Route Transparency */}
      <section className="py-14 md:py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gradient mb-4">Transparent Route Preview</h2>
            <p className="text-lg text-muted-foreground">
              See how your swap is routed, including expected output, fees, and slippage. We surface the details so you can confirm with confidence.
            </p>
          </motion.div>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[
                  "Clear expected output",
                  "Estimated fees and slippage",
                  "Best available route",
                  "Status updates and final confirmation"
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                    <p className="text-base md:text-lg">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Lock className="w-16 h-16 mx-auto mb-6 text-primary" />
            <h2 className="text-4xl font-bold text-gradient mb-6">Non-Custodial by Design</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Pegasus Swap is non-custodial — you maintain control of your assets at all times. Transactions are signed by your wallet; we provide the interface and clarity.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {[
                "Explicit approvals for each action",
                "Clear error messages and recovery steps",
                "No hidden custodial risk"
              ].map((point, index) => (
                <Card key={index} className="glass-card">
                  <CardContent className="pt-6 pb-6">
                    <CheckCircle className="w-8 h-8 mx-auto mb-3 text-primary" />
                    <p>{point}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              Crypto assets carry risk. Only swap what you can afford to lose.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Wallets Supported */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-gradient mb-6">Wallets We Support</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Connect a popular Solana wallet to get started.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {["Phantom", "Solflare", "Backpack", "Glow", "Ledger"].map((wallet) => (
                <div key={wallet} className="glass-card px-6 py-4 rounded-xl">
                  <p className="font-semibold">{wallet}</p>
                </div>
              ))}
            </div>

            <ConnectWalletButton />
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gradient mb-4">Frequently Asked Questions</h2>
          </motion.div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="glass-card px-6 rounded-xl border-0">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                What makes Pegasus Swap fast?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Solana's high throughput and low latency enable rapid quotes and confirmations, designed for real-time swapping.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="glass-card px-6 rounded-xl border-0">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                Is Pegasus Swap custodial?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No. It's non-custodial — you always control your assets.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="glass-card px-6 rounded-xl border-0">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                What fees will I pay?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We show estimated network fees and any route-related costs upfront. No hidden fees.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="glass-card px-6 rounded-xl border-0">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                How do I handle slippage?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Set a slippage tolerance that matches your goals. We surface expected output and slippage before you confirm.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="glass-card px-6 rounded-xl border-0">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                Do you support mobile?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes — the interface is responsive and optimized for touch.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="glass-card px-6 rounded-xl border-0">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                Which wallets can I use?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Most popular Solana wallets are supported. Connect to get started.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Primary CTA Section */}
      <section className="py-32 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 rounded-2xl text-center space-y-8 glow-effect"
          >
            <h2 className="text-5xl font-bold text-gradient">Ready to Swap with Confidence?</h2>
            <p className="text-xl text-muted-foreground">
              Connect your wallet to explore routes and confirm your first swap.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <ConnectWalletButton />
              <Button variant="outline" size="lg" className="border-primary/50 hover:bg-primary/10">
                Explore Routes
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4 text-primary">Product</h3>
              <ul className="space-y-2">
                <li><a href="/" className="text-muted-foreground hover:text-foreground transition-colors">Swap</a></li>
                <li><a href="/why-pegasus" className="text-muted-foreground hover:text-foreground transition-colors">Why Pegasus</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-primary">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Docs</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-primary">Legal</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground border-t border-white/10 pt-8">
            © Pegasus Swap. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WhyPegasus;
