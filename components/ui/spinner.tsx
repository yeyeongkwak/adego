import { cn } from '@/lib/utils/utils'
import { ComponentProps } from 'react'
import { Loader2Icon } from 'lucide-react'

export function Spinner({ className, ...props }: ComponentProps<'svg'>) {
    return (
        <Loader2Icon
            role="status"
            aria-label="Loading"
            className={cn('size-4 animate-spin', className)}
            {...props}
        />
    )
}
