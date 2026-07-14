import Link from 'next/link';
import { signOut } from '@/auth';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <div className="console-shell"><aside><div className="brand">ANEES <span>OPS</span></div><p className="sidebar-note">Sensor infrastructure</p><nav><Link href={'/' as any}>Overview</Link><Link href={'/devices' as any}>Devices</Link><Link href={'/audit' as any}>Audit log</Link><Link href={'/health' as any}>System health</Link></nav><form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}><button className="signout" type="submit">Sign out</button></form></aside><main className="console-main">{children}</main></div>;
}
