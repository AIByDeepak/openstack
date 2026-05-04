import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { DashboardProvider } from "@/context/DashboardContext";
import Layout from "@/components/layout/Layout";
import Overview from "@/pages/Overview";
import Hosts from "@/pages/Hosts";
import CpuConfig from "@/pages/CpuConfig";
import Visibility from "@/pages/Visibility";
import Pockets from "@/pages/Pockets";
import Aggregator from "@/pages/Aggregator";
import Placement from "@/pages/Placement";
import Migration from "@/pages/Migration";
import Instances from "@/pages/Instances";
import Metrics from "@/pages/Metrics";
import ComingSoon from "@/pages/ComingSoon";

function App() {
    return (
        <div className="App">
            <DashboardProvider>
                <BrowserRouter>
                    <Layout>
                        <Routes>
                            <Route path="/" element={<Overview />} />
                            <Route path="/hosts" element={<Hosts />} />
                            <Route path="/cpu-config" element={<CpuConfig />} />
                            <Route path="/pockets" element={<Pockets />} />
                            <Route path="/instances" element={<Instances />} />
                            <Route path="/visibility" element={<Visibility />} />
                            <Route path="/aggregator" element={<Aggregator />} />
                            <Route path="/placement" element={<Placement />} />
                            <Route path="/migration" element={<Migration />} />
                            <Route path="/metrics" element={<Metrics />} />
                            <Route path="/settings" element={<ComingSoon slug="settings" />} />
                        </Routes>
                    </Layout>
                </BrowserRouter>
            </DashboardProvider>
            <Toaster
                position="bottom-right"
                theme="dark"
                toastOptions={{
                    style: {
                        background: "hsl(230 22% 15%)",
                        border: "1px solid hsl(230 18% 22%)",
                        color: "hsl(230 25% 96%)",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "12px",
                    },
                }}
            />
        </div>
    );
}

export default App;
