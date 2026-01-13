import { useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { useNotifications } from "../../hooks/useNotifications"
import { useAQIAlert, getAQIColor } from "../../hooks/useAQIAlert"
import { Button } from "../ui/button"
import {
    LogOut,
    User,
    Menu,
    Bell,
    X,
    AlertTriangle,
    Wind
} from "lucide-react"

export function Navbar() {
    const { user, logout } = useAuth()
    const { data: notifications } = useNotifications()
    const { data: aqiAlert } = useAQIAlert()
    const [showNotifications, setShowNotifications] = useState(false)
    const [showAQIAlert, setShowAQIAlert] = useState(false)

    // Determine if there are unread/critical alerts (e.g. created in last 24h)
    const hasUnread = notifications?.some(n =>
        n.type === 'alerts' && new Date(n.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    // Check if AQI is elevated
    const hasHighAQI = aqiAlert?.isHighAQI;
    const aqiColor = getAQIColor(aqiAlert?.aqiLevel);

    return (
        <header className="flex h-16 items-center gap-4 border-b bg-card/50 backdrop-blur-xl border-white/10 dark:border-white/5 px-6 sticky top-0 z-30">
            <div className="flex flex-1 items-center gap-4">
                {/* Mobile Menu Trigger could go here */}
            </div>
            <div className="flex items-center gap-4">

                {/* AQI Alert Badge */}
                {hasHighAQI && (
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`relative rounded-full hover:bg-white/10 transition-colors ${aqiColor.bgClass}`}
                            onClick={() => setShowAQIAlert(!showAQIAlert)}
                            title={`High AQI: ${aqiAlert?.aqiLevel} - ${aqiColor.label}`}
                        >
                            <Wind className={`h-5 w-5 ${aqiColor.textClass}`} />
                            <span className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${aqiColor.color} animate-pulse ring-2 ring-background border border-white/20`} />
                        </Button>

                        {showAQIAlert && (
                            <>
                                <div
                                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm/50"
                                    onClick={() => setShowAQIAlert(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                                    <div className={`p-4 border-b border-white/10 flex items-center gap-3 ${aqiColor.bgClass}`}>
                                        <AlertTriangle className={`h-5 w-5 ${aqiColor.textClass}`} />
                                        <div className="flex-1">
                                            <h3 className="font-bold text-sm">Air Quality Alert</h3>
                                            <p className={`text-xs ${aqiColor.textClass}`}>{aqiColor.label}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setShowAQIAlert(false)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-foreground/70">Current AQI</span>
                                                <span className={`text-2xl font-bold ${aqiColor.textClass}`}>{aqiAlert?.aqiLevel}</span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-full ${aqiColor.color} transition-all duration-300`}
                                                    style={{
                                                        width: `${Math.min((aqiAlert?.aqiLevel || 0) / 5, 100)}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {aqiAlert?.location && (
                                            <div className="text-xs text-muted-foreground">
                                                📍 {aqiAlert.location}
                                            </div>
                                        )}
                                        <div className="pt-2 text-xs text-muted-foreground space-y-1">
                                            <p>• Sensitive groups should limit outdoor exposure</p>
                                            <p>• Consider wearing a protective mask</p>
                                            <p>• Drink plenty of water</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Notification Bell */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative rounded-full hover:bg-white/10"
                        onClick={() => setShowNotifications(!showNotifications)}
                        title="Notifications"
                    >
                        <Bell className="h-5 w-5" />
                        {hasUnread && (
                            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-background border border-white/20" />
                        )}
                    </Button>

                    {showNotifications && (
                        <>
                            <div
                                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm/50"
                                onClick={() => setShowNotifications(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                                <div className="p-3 border-b border-white/10 flex items-center justify-between bg-muted/40">
                                    <h3 className="font-semibold text-sm">Notifications</h3>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setShowNotifications(false)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {notifications?.length > 0 ? (
                                        <div className="divide-y divide-white/5">
                                            {notifications.map((notif) => (
                                                <div key={notif.id || notif._id} className="p-4 hover:bg-muted/30 transition-colors">
                                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${notif.type === 'alerts'
                                                                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                                : 'bg-primary/10 text-primary border border-primary/20'
                                                            }`}>
                                                            {notif.type}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                            {new Date(notif.timestamp || notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-foreground/90 leading-relaxed">{notif.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm">No notifications yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

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
