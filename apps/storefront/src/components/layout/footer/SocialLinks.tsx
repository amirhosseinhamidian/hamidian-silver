import Image from 'next/image';

import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';

type IconSocial = {
  name: string;
  type: 'icon';
  icon: React.ElementType;
  href: string;
};

type ImageSocial = {
  name: string;
  type: 'image';
  src: string;
  href: string;
};

type Social = IconSocial | ImageSocial;

const socials: Social[] = [
  {
    name: 'Instagram',
    type: 'icon',
    icon: FaInstagram,
    href: '#',
  },
  {
    name: 'Telegram',
    type: 'icon',
    icon: FaTelegramPlane,
    href: '#',
  },
  {
    name: 'Bale',
    type: 'image',
    src: '/icons/social/bale.svg',
    href: '#',
  },
];

export function SocialLinks() {
  return (
    <div
      className="
        flex
        items-center
        gap-4
      "
    >
      {socials.map((social) => {
        if (social.type === 'image') {
          return (
            <a
              key={social.name}
              href={social.href}
              aria-label={social.name}
              className="
                transition
                duration-300
                hover:opacity-60
              "
            >
              <Image src={social.src} alt={social.name} width={18} height={18} />
            </a>
          );
        }

        const Icon = social.icon;

        return (
          <a
            key={social.name}
            href={social.href}
            aria-label={social.name}
            className="
              transition
              duration-300
              hover:opacity-60
            "
          >
            <Icon size={18} strokeWidth={1.5} />
          </a>
        );
      })}
    </div>
  );
}
