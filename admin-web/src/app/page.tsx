import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'super_admin') redirect('/login?error=unauthorized');
  return (
    <main className="console-placeholder">
      <div className="eyebrow">ANEES / OPERATIONS</div>
      <h1>Sensor fleet console</h1>
      <p>The protected shell is ready. Fleet controls are being connected next.</p>
    </main>
  );
}
