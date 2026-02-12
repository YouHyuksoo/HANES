"use client";

/**
 * @file src/components/ui/Card.tsx
 * @description 카드 컴포넌트 - 콘텐츠 컨테이너
 *
 * 초보자 가이드:
 * 1. **Card**: 기본 카드 컨테이너
 * 2. **CardHeader**: 제목 영역
 * 3. **CardContent**: 내용 영역
 * 4. **CardFooter**: 하단 액션 영역
 */
import { forwardRef, HTMLAttributes } from 'react';

// ========================================
// Card 컨테이너
// ========================================
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', padding = 'lg', hover = false, children, ...props }, ref) => {
    const baseStyles = 'rounded-2xl border border-border transition-all duration-200 animate-fade-in';

    const variantStyles = {
      default: 'bg-card',
      glass: 'bg-card/80 backdrop-blur-md dark:bg-card/50',
    };

    const hoverStyles = hover ? 'hover:shadow-lg hover:border-primary/50' : '';

    const paddingStyles = {
      none: '',
      sm: 'px-4 py-3',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${hoverStyles}
          ${paddingStyles[padding]}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// ========================================
// Card Header
// ========================================
export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', title, subtitle, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          flex items-center justify-between
          mb-4
          ${className}
        `}
        {...props}
      >
        <div>
          {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          {children}
        </div>
        {action && <div>{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// ========================================
// Card Content
// ========================================
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`text-text ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

// ========================================
// Card Footer
// ========================================
const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardContent, CardFooter };
export default Card;
