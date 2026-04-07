import { MouseEventHandler, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '../styles/BackButton.module.css'

type BackButtonProps = {
    label?: string
    to?: string
    fallbackTo?: string
    onClick?: MouseEventHandler<HTMLButtonElement>
    className?: string
    style?: React.CSSProperties
    variant?: 'primary' | 'secondary' | 'outline'
    size?: 'sm' | 'md' | 'lg'
    showIcon?: boolean
    icon?: ReactNode
    withBaseClass?: boolean
    disabled?: boolean
}

export default function BackButton({
    label = 'Quay lại',
    to,
    fallbackTo = '/',
    onClick,
    className = '',
    style,
    variant = 'secondary',
    size = 'md',
    showIcon = true,
    icon = <span aria-hidden="true">&larr;</span>,
    withBaseClass = true,
    disabled = false
}: BackButtonProps) {
    const navigate = useNavigate()

    const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        if (disabled) return

        if (onClick) {
            onClick(event)
            return
        }

        if (to) {
            navigate(to)
            return
        }

        if (window.history.length > 1) navigate(-1)
        else navigate(fallbackTo)
    }

    const sizeClass = size === 'md' ? '' : `btn-${size}`
    const baseClasses = withBaseClass ? `btn btn-${variant} ${sizeClass}` : ''

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={`${baseClasses} ${styles.backButton} ${className}`.trim()}
            style={style}
        >
            {showIcon && <span className={styles.icon}>{icon}</span>}
            <span>{label}</span>
        </button>
    )
}
