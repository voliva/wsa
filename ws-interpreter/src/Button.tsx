import { ButtonHTMLAttributes, FC } from "react";
import { twMerge } from "tailwind-merge";

export const Button: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className,
  ...props
}) => (
  <button
    type="button"
    className={twMerge("border rounded py-1 px-2", className)}
    {...props}
  />
);
