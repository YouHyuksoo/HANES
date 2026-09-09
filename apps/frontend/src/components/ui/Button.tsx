"use client";

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
import { useTranslation } from 'react-i18next';
import HelpTooltip from '@/components/shared/HelpTooltip';
import HelpTarget from '@/components/tour/HelpTarget';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabledReason?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  tourHelpKey?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabledReason,
      leftIcon,
      rightIcon,
      tourHelpKey,
      disabled,
      children,
      title,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    // 기본 스타일
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-bold rounded-lg
      transition-all duration-200 ease-in-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none
    `;

    // variant 스타일
    const variantStyles = {
      primary: `
        bg-primary text-white
        shadow-lg shadow-primary/25
        hover:bg-primary-hover hover:-translate-y-0.5
        focus-visible:ring-primary
      `,
      secondary: `
        bg-card border border-border text-foreground
        hover:bg-card-hover
        focus-visible:ring-primary
      `,
      outline: `
        bg-transparent border border-border text-foreground
        hover:bg-card-hover hover:border-border-hover
        focus-visible:ring-primary
      `,
      ghost: `
        bg-transparent text-foreground
        hover:bg-black/5 dark:hover:bg-white/5
        focus-visible:ring-primary
      `,
      danger: `
        bg-error text-white
        shadow-lg shadow-error/25
        hover:opacity-90 hover:-translate-y-0.5
        focus-visible:ring-error
      `,
    };

    // size 스타일
    const sizeStyles = {
      sm: 'h-9 px-4 text-sm',
      md: 'h-10 px-6 text-sm',
      lg: 'h-12 px-8 text-base',
    };

    const isActionDisabled = disabled || isLoading;
    const disabledHelp = isActionDisabled
      ? (isLoading ? t('common.actionProcessingHelp', '처리 중입니다. 완료될 때까지 기다려 주세요.') : disabledReason || title)
      : undefined;
    const buttonNode = (
      <button
        ref={ref}
        type="button"
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
          ${disabledHelp ? 'pointer-events-none' : ''}
        `}
        disabled={isActionDisabled}
        title={disabledHelp ? undefined : title}
        aria-label={title ?? undefined}
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

    const tourLabel = title ?? (typeof children === 'string' ? children : '버튼');
    const tourKey = tourHelpKey ?? `common.actions.${tourLabel}`;
    const tourNode = <HelpTarget helpKey={tourKey} label={tourLabel}
      fallbackDescription={`${tourLabel} 작업을 실행합니다. 처리 결과는 화면의 목록과 안내 메시지에서 확인하세요.`}>
      {buttonNode}
    </HelpTarget>;

    if (disabledHelp) {
      return (
        <HelpTooltip description={disabledHelp} focusable
          className={className.split(/\s+/).filter(token => /^(?:(?:sm|md|lg|xl):)?(?:w-|min-w-|max-w-|flex-1$|grow$|shrink-0$)/.test(token)).join(' ')}>
          {tourNode}
        </HelpTooltip>
      );
    }

    return tourNode;
  }
);

Button.displayName = 'Button';

export default Button;
