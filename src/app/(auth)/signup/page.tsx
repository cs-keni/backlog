import { motion } from 'framer-motion'

export default function SignupPage() {
  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
          <svg
            className="h-6 w-6 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">
          Account creation is temporarily closed
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Backlog is a personal tool. Accounts are provisioned manually.
          <br />
          If you need access, reach out directly.
        </p>
      </div>

      <a
        href="/login"
        className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline transition-colors"
      >
        Back to sign in
      </a>
    </div>
  )
}
