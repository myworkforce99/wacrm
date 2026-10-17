import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode; // "+ Add Lead" button etc.
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 pb-5">
      <div className="min-w-0">
        <h1 className="text-foreground text-2xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
