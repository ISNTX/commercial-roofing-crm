import { AuthProvider, useAuth } from "@/lib/AuthProvider";
import LeadsDashboard from "./pages/LeadsDashboard";
import Login from "./pages/Login";

function AppShell() {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Commercial Roofing CRM</h1>
          <p className="text-sm text-slate-500">Texas lead-gen dashboard</p>
        </div>
        <button
          onClick={signOut}
          className="rounded-md border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Sign out
        </button>
      </header>
      <main className="p-6">
        <LeadsDashboard />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
