export default function NoAccess() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F2EF] dark:bg-[#050508] px-6">
      <div className="max-w-[420px] text-center">
        <h1 className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white mb-3">
          This account is not attached to a workspace yet
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
          You are signed in, but there is no organization linked to this address. If you
          just bought a plan, onboarding may still be finishing. Otherwise reply to your
          onboarding email and we will sort it.
        </p>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="font-grotesk text-xs font-semibold uppercase tracking-[1px] text-[#2B50DC] dark:text-[#5B8DEF] cursor-pointer bg-transparent border-0"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
