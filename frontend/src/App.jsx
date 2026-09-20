import { useCallback, useState } from "react";
import { useWallet } from "./hooks/useWallet.js";
import { useSentinelClient } from "./hooks/useSentinelClient.js";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import Hero from "./components/sections/Hero.jsx";
import HowItWorks from "./components/sections/HowItWorks.jsx";
import About from "./components/sections/About.jsx";
import Dashboard from "./components/sections/Dashboard.jsx";
import InteractionZone from "./components/sections/InteractionZone.jsx";

export default function App() {
  const wallet = useWallet();
  const sentinel = useSentinelClient(wallet.address);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="min-h-screen">
      <Header wallet={wallet} sentinel={sentinel} />
      <main>
        <Hero />
        <HowItWorks />
        <About />
        <Dashboard
          sentinel={sentinel}
          selectedTarget={selectedTarget}
          onSelectTarget={setSelectedTarget}
          refreshKey={refreshKey}
        />
        <InteractionZone
          sentinel={sentinel}
          wallet={wallet}
          selectedTarget={selectedTarget}
          onSelectTarget={setSelectedTarget}
          onChainChanged={bumpRefresh}
        />
      </main>
      <Footer />
    </div>
  );
}
