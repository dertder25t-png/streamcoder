function compareSemverCore(a: string, b: string): -1 | 0 | 1 {
  const validSemver = (version: string): boolean => {
    const semverRegex = /^(v?)\d+(\.\d+(\.\d+)?)?(?:-[\da-zA-Z-]+(\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(\.[\da-zA-Z-]+)*)?$/;
    return semverRegex.test(version);
  };

  if (!validSemver(a) || !validSemver(b)) {
    throw new Error("Malformed version string");
  }

  const normalize = (version: string): string => {
    version = version.replace(/^v/, '');
    const parts = version.split('.').map(part => part.padStart(3, '0'));
    return parts.join('.');
  };

  a = normalize(a);
  b = normalize(b);

  return a === b ? 0 : a < b ? -1 : 1;
}

export { compareSemverCore };
