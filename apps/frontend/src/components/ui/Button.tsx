/**
 * @file src/components/ui/Button.tsx
 * @description 프리미엄 버튼 컴포넌트 - 다크/라이트 모드 대응
 *
 * 초보자 가이드:
 * 1. **variant**: 버튼 스타일 종류 (primary, secondary, outline, ghost)
 * 2. **size**: 버튼 크기 (sm, md, lg)
 * 3. **forwardRef**: 부모 컴포넌트에서 ref 접근 가능
 */
import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // 기본 스타일
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-[var(--radius)]
      transition-all duration-200 ease-in-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      ripple
    `;

    // variant 스타일
    const variantStyles = {
      primary: `
        bg-primary text-white
        hover:bg-primary-hover
        focus-visible:ring-primary
        active:scale-[0.98]
      `,
      secondary: `
        bg-secondary text-white
        hover:opacity-90
        focus-visible:ring-secondary
        active:scale-[0.98]
      `,
      outline: `
        border-2 border-primary text-primary
        bg-transparent
        hover:bg-primary hover:text-white
        focus-visible:ring-primary
      `,
      ghost: `
        bg-transparent text-text
        hover:bg-surface
        dark:hover:bg-white/10
        focus-visible:ring-primary
      `,
      danger: `
        bg-error text-white
        hover:opacity-90
        focus-visible:ring-error
        active:scale-[0.98]
      `,
    };

    // size 스타일
    const sizeStyles = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    };

    return (
      <button
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
