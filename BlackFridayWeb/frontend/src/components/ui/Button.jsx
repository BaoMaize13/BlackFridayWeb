export function Button({
  children,
  className = "",
  tone = "primary",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`button button--${tone} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
