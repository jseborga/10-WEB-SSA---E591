import { AdminShell } from '@/components/admin/admin-shell'

export const metadata = {
  title: 'Admin | SSA Ingenieria',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminPage() {
  return <AdminShell />
}
