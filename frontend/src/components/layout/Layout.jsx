import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Layout({ children }) {
    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 min-w-0 flex flex-col">
                <TopBar />
                <main data-testid="app-main" className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
