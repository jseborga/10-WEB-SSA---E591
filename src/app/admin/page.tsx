import { AdminPanel } from '@/components/admin-panel'

export const metadata = {
  title: 'Admin | SSA Ingenieria',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-zinc-100">
      <AdminPanel initialOpen hideLauncher fullPage />
    </main>
  )
}
