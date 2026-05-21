import React from "react";

const icons = {
  appointments: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="M9 14h2v2H9z" fill="currentColor" stroke="none" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 18c1-2.6 3.1-4 5.5-4s4.5 1.4 5.5 4" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M14.8 18c0.7-1.8 2-2.8 3.7-2.8 1.6 0 2.9 1 3.7 2.8" />
    </>
  ),
  finance: (
    <>
      <path d="M4 19h16" />
      <path d="M6 16V9" />
      <path d="M12 16V5" />
      <path d="M18 16v-4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.8-3.2 4.7-5 8-5s6.2 1.8 8 5" />
    </>
  ),
  email: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="m4 8 8 6 8-6" />
    </>
  ),
};

export default function SvgIcon({ name, ...props }) {
  const commonProps = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };

  const IconComponent = icons[name];

  if (!IconComponent) return null;

  return <svg {...commonProps}>{IconComponent}</svg>;
}