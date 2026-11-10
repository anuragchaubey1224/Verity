"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { AuthShell, Field, PasswordField, FormError } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

export default function SignupPage() {
  const { register } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    setError(null)
    try {
      await register(email.trim(), password)
      router.replace("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your documents and chats stay private to you"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />
        <PasswordField
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
        <FormError>{error}</FormError>
        <Button type="submit" disabled={loading} className="h-10 w-full gap-2">
          {loading ? (<><Loader2 className="size-4 animate-spin" /> Creating account…</>) : "Create account"}
        </Button>
      </form>
    </AuthShell>
  )
}
