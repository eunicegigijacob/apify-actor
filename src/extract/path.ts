export function normalizePath(path: string): string {
    let value = path.trim();
    value = value.replace(/[.,;)]+$/, '');
    value = value.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    value = value.replace(/<([A-Za-z_][A-Za-z0-9_]*)>/g, '{$1}');
    if (value.length > 1) value = value.replace(/\/+$/, '');
    return value.startsWith('/') ? value : `/${value}`;
}

export function endpointKey(method: string, path: string, version = ''): string {
    const base = `${method.toUpperCase()} ${normalizePath(path)}`;
    return version ? `${base} ${version}` : base;
}

export function compatibleEndpointKey(method: string, path: string, version = ''): string[] {
    const base = `${method.toUpperCase()} ${normalizePath(path)}`;
    return version ? [base, `${base} ${version}`] : [base];
}
