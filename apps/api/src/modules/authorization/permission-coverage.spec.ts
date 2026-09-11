import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const MODULES_ROOT = join(process.cwd(), 'src', 'modules');
const HTTP_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete)\b/;

function collectControllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectControllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

describe('administrative API permission coverage', () => {
  it('marks every endpoint in permission-protected controllers as public or permission-gated', () => {
    const uncovered: string[] = [];

    for (const file of collectControllerFiles(MODULES_ROOT)) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('RequirePermissions')) continue;

      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (!HTTP_DECORATOR.test(line)) return;

        const nearbyDecorators = lines.slice(Math.max(0, index - 2), index + 3).join('\n');
        const endpointDeclaration = lines.slice(index, index + 14).join('\n');
        const isCustomerScoped = endpointDeclaration.includes('@CurrentPrincipal()');
        const isAuthenticatedGatewayDiscovery = line.includes("@Get('gateways')");
        if (
          !nearbyDecorators.includes('@Public()') &&
          !nearbyDecorators.includes('@RequirePermissions(') &&
          !isCustomerScoped &&
          !isAuthenticatedGatewayDiscovery
        ) {
          uncovered.push(`${relative(process.cwd(), file)}:${index + 1} ${line.trim()}`);
        }
      });
    }

    if (uncovered.length > 0) {
      throw new Error(`Endpoints missing @Public or @RequirePermissions:\n${uncovered.join('\n')}`);
    }
    expect(uncovered).toEqual([]);
  });
});
