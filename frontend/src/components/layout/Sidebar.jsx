import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, MapPin, CloudSun, Activity } from "lucide-react"
import { cn } from "../../lib/utils"

const sidebarItems = [
    {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
    },
    {
        title: "Locations",
        href: "/locations",
        icon: MapPin,
    },
]

export function Sidebar({ className }) {
    const location = useLocation()

    return (
        <div className={cn("pb-12 min-h-screen border-r bg-card/50 backdrop-blur-xl border-white/10 dark:border-white/5", className)}>
            <div className="space-y-4 py-8">
                <div className="px-3 py-2">
                    <div className="flex items-center gap-2 mb-8 px-4 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-xl blur-xl"></div>
                        <div className="bg-gradient-to-br from-primary to-violet-500 p-2 rounded-xl relative z-10 shadow-lg shadow-primary/30">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400 bg-clip-text text-transparent animate-gradient relative z-10">
                            AirSense
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {sidebarItems.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                            >
                                <span className={cn(
                                    "group flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out",
                                    location.pathname === item.href
                                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                                        : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground"
                                )}>
                                    <item.icon className={cn("mr-3 h-5 w-5 transition-transform group-hover:scale-110", location.pathname === item.href ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
                                    {item.title}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
