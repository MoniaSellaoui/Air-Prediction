import { useAuth } from "../../hooks/useAuth"
import { Button } from "../ui/button"
import {
    LogOut,
    User,
    Menu
} from "lucide-react"

export function Navbar() {
    const { user, logout } = useAuth()

    return (
        <header className="flex h-16 items-center gap-4 border-b bg-card/50 backdrop-blur-xl border-white/10 dark:border-white/5 px-6 sticky top-0 z-30">
            <div className="flex flex-1 items-center gap-4">
                {/* Mobile Menu Trigger could go here */}
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/50 dark:bg-black/20 border border-white/20">
                    <div className="bg-primary/20 p-1 rounded-full">
                        <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium pr-1">{user?.name || user?.email || "User"}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} title="Logout" className="hover:bg-red-500/10 hover:text-red-500 rounded-full transition-colors">
                    <LogOut className="h-5 w-5" />
                    <span className="sr-only">Logout</span>
                </Button>
            </div>
        </header>
    )
}
