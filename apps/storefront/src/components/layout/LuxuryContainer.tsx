interface LuxuryContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function LuxuryContainer({ children, className = '' }: LuxuryContainerProps) {
  return (
    <div className={['mx-auto', 'w-full', 'max-w-7xl', 'px-6', 'md:px-10', className].join(' ')}>
      {children}
    </div>
  );
}
