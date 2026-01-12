import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Navbar } from "./Navbar"

export default function Layout() {
    return (
        <div className="flex min-h-screen w-full flex-col md:flex-row bg-muted/40 absolute inset-0">
            <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 border-r bg-background md:block">
                <Sidebar />
            </aside>
            <div className="flex flex-col sm:gap-4 sm:pl-64 w-full">
                <Navbar />
                <main className="flex-1 p-4 sm:px-6 sm:py-0 overflow-auto">
                    <div className="py-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
