import Image from 'next/image';

export function Logo() {
  return <Image src="/logo.png" alt="Hamidian Silver" width={180} height={60} priority />;
}
