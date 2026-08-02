import LeadsDashboard from "./pages/LeadsDashboard";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">Commercial Roofing CRM</h1>
        <p className="text-sm text-slate-500">Texas lead-gen dashboard</p>
      </header>
      <main className="p-6">
        <LeadsDashboard />
      </main>
    </div>
  );
}
