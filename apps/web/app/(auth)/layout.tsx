import React from 'react';
import accessibility from '@/components/ui/accessibility.module.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className={`${accessibility.root} min-h-screen flex items-center justify-center bg-background text-on-surface p-4`}>
      <div className="w-full flex justify-center">
        {children}
      </div>
    </main>
  );
}
