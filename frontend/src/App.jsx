import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useWallet } from "./hooks/useWallet.js";
import { useSentinelClient } from "./hooks/useSentinelClient.js";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import ScrollManager from "./components/layout/ScrollManager.jsx";
import HomePage from "./pages/HomePage.jsx";
import TargetsPage from "./pages/TargetsPage.jsx";
import TargetDetailPage from "./pages/TargetDetailPage.jsx";
import ActivityPage from "./pages/ActivityPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

export default function App() {
  const wallet = useWallet();
  const sentinel = useSentinelClient(wallet.address);

  return (
    <BrowserRouter>
      <ScrollManager />
      <div className="min-h-screen">
        <Header wallet={wallet} sentinel={sentinel} />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/targets" element={<TargetsPage sentinel={sentinel} />} />
            <Route
              path="/targets/:address"
              element={<TargetDetailPage sentinel={sentinel} wallet={wallet} />}
            />
            <Route path="/activity" element={<ActivityPage sentinel={sentinel} />} />
            <Route path="/admin" element={<AdminPage sentinel={sentinel} wallet={wallet} />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
