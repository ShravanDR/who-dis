interface MemberAvatarProps {
  name: string
  photo: string      // URL or emoji
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
}

export default function MemberAvatar({ name, photo, size = 'md' }: MemberAvatarProps) {
  const isUrl = photo.startsWith('http') || photo.startsWith('/')
  const sizeClass = sizes[size]

  return (
    <div className="flex items-center gap-3">
      <div className={`${sizeClass} rounded-full overflow-hidden bg-[#F0ECE4] flex items-center justify-center flex-shrink-0`}>
        {isUrl ? (
          <img src={photo} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{photo}</span>
        )}
      </div>
      <span className="font-medium text-[#1a1a1a]">{name}</span>
    </div>
  )
}
