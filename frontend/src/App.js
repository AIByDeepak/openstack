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
                            <Route path="/visibility" element={<Visibility />} />
                            <Route path="/pockets" element={<Pockets />} />
                            <Route path="/aggregates" element={<ComingSoon slug="aggregates" />} />
                            <Route path="/vm-placement" element={<ComingSoon slug="vm-placement" />} />
                            <Route path="/migration" element={<ComingSoon slug="migration" />} />
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
