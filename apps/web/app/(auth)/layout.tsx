import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface p-4">
      <div className="w-full flex justify-center">
        {children}
      </div>
    </div>
  );
}
