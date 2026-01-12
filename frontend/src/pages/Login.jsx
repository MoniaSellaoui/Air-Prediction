import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Loader2, Wind } from "lucide-react"

export default function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        const success = await login(email, password)
        setIsLoading(false)
        if (success) {
            navigate("/")
        }
    }

    return (
        <div className="w-full min-h-screen grid lg:grid-cols-2">
            {/* Left Side - Hero/Gradient */}
            <div className="hidden lg:flex flex-col justify-between bg-primary p-10 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-primary to-indigo-800 animate-gradient" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534081333815-ae5019106622?q=80&w=2000&auto=format&fit=crop')] bg-cover opacity-20 mix-blend-overlay" />

                <div className="relative z-10 flex items-center gap-2">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                        <Wind className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold">AirSense</span>
                </div>

                <div className="relative z-10 space-y-4 max-w-lg">
                    <h1 className="text-4xl font-bold leading-tight">
                        Monitor Air Quality in Real-Time
                    </h1>
                    <p className="text-lg text-white/80">
                        Join thousands of users making smarter decisions about their environment with our AI-powered predictions.
                    </p>
                </div>

                <div className="relative z-10 text-sm text-white/60">
                    &copy; 2024 AirSense Inc.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex items-center justify-center p-8 bg-background">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] animate-fade-in">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                        <p className="text-sm text-balance text-muted-foreground">
                            Enter your email below to login to your account
                        </p>
                    </div>

                    <div className="grid gap-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-muted/30"
                                />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        to="/forgot-password"
                                        className="ml-auto text-sm underline-offset-4 hover:underline text-primary"
                                    >
                                        Forgot your password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-muted/30"
                                />
                            </div>
                            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sign In
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    Or continue with
                                </span>
                            </div>
                        </div>
                        {/* Social login buttons could go here */}
                    </div>

                    <p className="px-8 text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link
                            to="/register"
                            className="underline underline-offset-4 hover:text-primary font-medium"
                        >
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
