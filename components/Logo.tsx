export function LogoMark({ size = 20 }: { size?: number }) {
	return (
		<svg className="logo-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
			<path d="M6.5 17.5V12.5M12 17.5V6.5M17.5 17.5V9.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
		</svg>
	);
}

export function Logo({ name }: { name: string }) {
	return (
		<span className="logo">
			<LogoMark />
			<span className="logo-name">{name}</span>
		</span>
	);
}
