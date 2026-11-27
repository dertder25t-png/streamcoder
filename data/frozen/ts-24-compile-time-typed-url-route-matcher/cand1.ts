type StaticParams<T extends string> = T extends `${infer Start}:${infer Param}/${infer Rest}`
  ? StaticParams<Rest> & (Param extends never ? Record<never, never> : { [K in Param]: string })
  : T extends `${infer Start}:${infer Param}`
  ? Param extends never ? Record<never, never> : { [K in Param]: string }
  : Record<never, never>;

type Decode<T extends string> = T extends `${infer Start}%${infer Mid}%${infer End}`
  ? Decode<Start> + decodeURIComponent(Mid) + Decode(End)
  : T;

function createRouteMatcher<P extends string>(pattern: P) {
  const regex = new RegExp(`^${pattern.split(':').map(segment => segment === '' ? '.*?' : `(${segment.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`).join('')}$`);
  const keys = pattern.split(':').filter(segment => segment !== '');

  return (path: string) => {
    const match = regex.exec(path);
    if (!match) return null;

    const params: Record<string, string> = {};
    keys.forEach((key, index) => {
      params[key] = Decode(match[index + 1]);
    });

    return params as StaticParams<P>;
  };
}

// Example usage:
const match = createRouteMatcher("/orgs/:orgId/repos/:repoId")("/orgs/123/repos/456");
console.log(match); // { orgId: '123', repoId: '456' }

const matchInvalid = createRouteMatcher("/orgs/:orgId/repos/:repoId")("/orgs/123/repos");
console.log(matchInvalid); // null

const matchMalformed = createRouteMatcher("/orgs/:orgId/repos/:repoId")("/orgs/123/repos/456%25");
console.log(matchMalformed); // null
