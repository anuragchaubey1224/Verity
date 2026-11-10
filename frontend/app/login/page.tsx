"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { AuthShell, Field, PasswordField, FormError } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
      router.replace("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Verity workspace"
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        <FormError>{error}</FormError>
        <Button type="submit" disabled={loading} className="h-10 w-full gap-2">
          {loading ? (<><Loader2 className="size-4 animate-spin" /> Signing in…</>) : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  )
}
